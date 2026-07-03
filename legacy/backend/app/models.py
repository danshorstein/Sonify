from typing import Literal, Optional
from pydantic import BaseModel


class SonificationOptions(BaseModel):
    mode: Literal['musical', 'precision'] = 'musical'
    duration_seconds: float = 8.0
    sample_rate: int = 44100
    scale: str = 'major_pentatonic'
    pitch_range: tuple[str, str] = ('C3', 'C5')
    smooth: bool = True
    downsample: Optional[str] = 'month'
    normalize: Literal['local', 'global'] = 'global'


class VegaLiteRequest(BaseModel):
    spec: dict
    options: SonificationOptions = SonificationOptions()
