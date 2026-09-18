"""LEGIBLE P3: dual-backend generator (D33) behind one `translate()` interface.

- CloudBackend: Anthropic claude-sonnet-5, structured output (research/04 §6).
  Requires ANTHROPIC_API_KEY; the anthropic package is imported lazily so the
  rest of the stack works without it. NO call happens unless invoked.
- LocalBackend: the fine-tuned LoRA GGUF via Ollama (P4 artifact). Until the
  model ships, points at any local Ollama model for wiring tests. Local mode
  pairs with deterministic-judge-only per D33.
- DryRunBackend: returns the assembled prompt instead of calling anything —
  the $0 path used by the Streamlit app until keys/models are provisioned.

All backends return TranslationResult with the §4 output contract fields.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from .audiences import AUDIENCES
from .rag import OUTPUT_SCHEMA, Exemplar, exemplar_block, retrieve, system_prompt, user_prompt

CLOUD_MODEL = "claude-sonnet-5"
LOCAL_MODEL = os.environ.get("LEGIBLE_OLLAMA_MODEL", "plaintext-9b")  # P4 artifact name


@dataclass
class TranslationResult:
    translation: str
    severity_conveyed: str | None
    preserved_facts: list[str] = field(default_factory=list)
    omitted_details: list[str] = field(default_factory=list)
    confidence: float | None = None
    backend: str = ""
    exemplars: list[Exemplar] = field(default_factory=list)
    raw: str = ""  # raw model output (debugging)
    assembled_prompt: str | None = None  # dry-run only


def _parse_contract(text: str) -> dict:
    """Parse the JSON output contract; tolerate fenced/prefixed output."""
    s = text.strip()
    if s.startswith("```"):
        s = s.split("```")[1]
        s = s[4:] if s.startswith("json") else s
    start, end = s.find("{"), s.rfind("}")
    if start == -1 or end == -1:
        return {"translation": text.strip(), "severity_conveyed": None,
                "preserved_facts": [], "omitted_details": [], "confidence": None}
    try:
        return json.loads(s[start:end + 1])
    except json.JSONDecodeError:
        return {"translation": text.strip(), "severity_conveyed": None,
                "preserved_facts": [], "omitted_details": [], "confidence": None}


def _assemble(finding: str, audience_key: str, format_key: str, k_final: int = 4):
    register = AUDIENCES[audience_key].retrieval_register
    exemplars = retrieve(finding, register=register, k_final=k_final)
    sys_p = system_prompt(audience_key, format_key)
    usr_p = exemplar_block(exemplars) + "\n\n" + user_prompt(finding)
    return sys_p, usr_p, exemplars


class DryRunBackend:
    """$0 backend: shows exactly what WOULD be sent. Default until keys exist."""

    name = "dry-run"

    def translate(self, finding: str, audience_key: str, format_key: str) -> TranslationResult:
        sys_p, usr_p, exemplars = _assemble(finding, audience_key, format_key)
        return TranslationResult(
            translation="(dry run — no model called; the assembled prompt is shown below)",
            severity_conveyed=None,
            backend=self.name,
            exemplars=exemplars,
            assembled_prompt=f"=== SYSTEM (cached prefix) ===\n{sys_p}\n\n=== USER ===\n{usr_p}",
        )


class CloudBackend:
    """Anthropic claude-sonnet-5 with the JSON output contract."""

    name = f"cloud:{CLOUD_MODEL}"

    def translate(self, finding: str, audience_key: str, format_key: str) -> TranslationResult:
        import anthropic  # lazy: optional dependency

        sys_p, usr_p, exemplars = _assemble(finding, audience_key, format_key)
        client = anthropic.Anthropic()  # needs ANTHROPIC_API_KEY
        msg = client.messages.create(
            model=CLOUD_MODEL,
            max_tokens=1024,
            system=[{"type": "text", "text": sys_p, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": usr_p}],
            output_config={"format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
        )
        raw = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        d = _parse_contract(raw)
        return TranslationResult(
            translation=d.get("translation", ""),
            severity_conveyed=d.get("severity_conveyed"),
            preserved_facts=d.get("preserved_facts", []),
            omitted_details=d.get("omitted_details", []),
            confidence=d.get("confidence"),
            backend=self.name,
            exemplars=exemplars,
            raw=raw,
        )


class LocalBackend:
    """Ollama local model (the P4 LoRA once it ships). Deterministic-judge-only mode."""

    name = f"local:{LOCAL_MODEL}"

    def translate(self, finding: str, audience_key: str, format_key: str) -> TranslationResult:
        import urllib.request

        sys_p, usr_p, exemplars = _assemble(finding, audience_key, format_key)
        body = json.dumps({
            "model": LOCAL_MODEL,
            "system": sys_p,
            "prompt": usr_p,
            "stream": False,
            "format": "json",
        }).encode()
        req = urllib.request.Request(
            "http://localhost:11434/api/generate", data=body,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=300) as r:
            raw = json.loads(r.read())["response"]
        d = _parse_contract(raw)
        return TranslationResult(
            translation=d.get("translation", ""),
            severity_conveyed=d.get("severity_conveyed"),
            preserved_facts=d.get("preserved_facts", []),
            omitted_details=d.get("omitted_details", []),
            confidence=d.get("confidence"),
            backend=self.name,
            exemplars=exemplars,
            raw=raw,
        )


class OpenAICompatBackend:
    """OpenAI, or any OpenAI-compatible endpoint (e.g. Gemini), with the JSON contract.

    Used when ANTHROPIC_API_KEY is absent but OPENAI_API_KEY / GEMINI_API_KEY exist.
    Model / base_url / key overridable via env (LEGIBLE_CLOUD_MODEL, LEGIBLE_CLOUD_BASE_URL).
    """

    def __init__(self, model: str | None = None, base_url: str | None = None, api_key: str | None = None):
        self.model = model or os.environ.get("LEGIBLE_CLOUD_MODEL", "gpt-5-mini")
        self.base_url = base_url or os.environ.get("LEGIBLE_CLOUD_BASE_URL")
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY") or os.environ.get("GEMINI_API_KEY")
        self.name = f"cloud:{self.model}"

    def translate(self, finding: str, audience_key: str, format_key: str) -> TranslationResult:
        from openai import OpenAI  # lazy: optional dependency

        sys_p, usr_p, exemplars = _assemble(finding, audience_key, format_key)
        client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        resp = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": sys_p},
                {"role": "user", "content": usr_p},
            ],
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or ""
        d = _parse_contract(raw)
        return TranslationResult(
            translation=d.get("translation", ""),
            severity_conveyed=d.get("severity_conveyed"),
            preserved_facts=d.get("preserved_facts", []),
            omitted_details=d.get("omitted_details", []),
            confidence=d.get("confidence"),
            backend=self.name,
            exemplars=exemplars,
            raw=raw,
        )


# --- MLX local backend (Apple Silicon; the plaintext-9b laptop edition) -----
_MLX_AUD_PHRASE = {
    "technical_leadership": "a technical leadership audience",
    "practitioner": "a hands-on security practitioner audience",
    "management": "a corporate board / senior management audience",
    "customer": "affected customers",
    "regulatory": "a regulator or legal audience",
    "public": "the general public",
}
_MLX_SYSTEM = (
    "You are a security communication translator. Rewrite the technical security "
    "finding as one crisp executive translation for {aud}. Lead with what an "
    "attacker can do; preserve the severity band, numbers, and preconditions "
    "exactly; never invent facts."
)


class MlxBackend:
    """Fine-tuned plaintext-9b as a 4-bit MLX model, served on-device.

    Uses the TRAINING prompt (system T1 + raw finding, NO exemplars): the local
    model is input-anchored and precedents live in the UI evidence panel only,
    never in its prompt. Deterministic-judge-only, per D33.
    """

    name = "local:plaintext-9b-mlx"
    _model = None
    _tok = None

    @staticmethod
    def _path() -> str:
        return os.path.expanduser(os.environ.get("LEGIBLE_MLX_PATH", "~/plaintext-9b-mlx"))

    @classmethod
    def available(cls) -> bool:
        return os.path.isdir(cls._path())

    def _load(self):
        if MlxBackend._model is None:
            from mlx_lm import load
            MlxBackend._model, MlxBackend._tok = load(self._path())
        return MlxBackend._model, MlxBackend._tok

    def translate(self, finding: str, audience_key: str, format_key: str) -> TranslationResult:
        from mlx_lm import generate

        model, tok = self._load()
        # exemplars are retrieved for the UI evidence panel, NOT fed to the model
        _, _, exemplars = _assemble(finding, audience_key, format_key)
        aud = _MLX_AUD_PHRASE.get(audience_key, "a technical leadership audience")
        messages = [
            {"role": "system", "content": _MLX_SYSTEM.format(aud=aud)},
            {"role": "user", "content": finding.strip()[:8000]},
        ]
        try:
            prompt = tok.apply_chat_template(
                messages, add_generation_prompt=True, tokenize=False, enable_thinking=False
            )
        except TypeError:  # template without the thinking switch
            prompt = tok.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
        raw = generate(model, tok, prompt=prompt, max_tokens=256, verbose=False)
        text = raw
        # the decoder can leave chat/control tokens in; strip them, then drop any
        # stray reasoning preamble that slips past the thinking switch
        for special in ("<|im_end|>", "<|endoftext|>", "<|im_start|>"):
            text = text.replace(special, "")
        for marker in ("</think>", "Thinking Process:"):
            if marker in text:
                text = text.split(marker)[-1]
        text = text.strip()
        return TranslationResult(
            translation=text,
            severity_conveyed=None,
            backend=self.name,
            exemplars=exemplars,
            raw=raw,
        )


def get_backend(kind: str = "auto"):
    """auto → on-device MLX model if present, else Anthropic/OpenAI keys, else dry-run."""
    if kind == "cloud":
        return CloudBackend()
    if kind == "openai":
        return OpenAICompatBackend()
    if kind == "gemini":
        return OpenAICompatBackend(
            model=os.environ.get("LEGIBLE_CLOUD_MODEL", "gemini-3-flash-preview"),
            base_url="https://generativelanguage.googleapis.com/v1beta/openai",
            api_key=os.environ.get("GEMINI_API_KEY"),
        )
    if kind == "mlx":
        return MlxBackend()
    if kind == "local":
        return MlxBackend() if MlxBackend.available() else LocalBackend()
    if kind == "dry":
        return DryRunBackend()
    if MlxBackend.available():
        return MlxBackend()
    if os.environ.get("ANTHROPIC_API_KEY"):
        return CloudBackend()
    if os.environ.get("OPENAI_API_KEY") or os.environ.get("GEMINI_API_KEY"):
        return OpenAICompatBackend()
    return DryRunBackend()
