from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .models import VegaLiteRequest
from .sonify.compiler import VegaLiteSonifier

app = FastAPI(title='Sonify')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

app.mount('/audio', StaticFiles(directory='generated_audio'), name='audio')


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/sonify/vegalite')
def sonify_vegalite(request: VegaLiteRequest):
    compiler = VegaLiteSonifier(request.spec, request.options)

    result = compiler.compile()

    return {
        'audio_url': f"/audio/{result['audio_file']}",
        'summary': result['summary'],
        'mapping': result['mapping'],
    }
