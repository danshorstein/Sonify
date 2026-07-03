import os
import uuid
import numpy as np
from scipy.io.wavfile import write

OUTPUT_DIR = 'generated_audio'
os.makedirs(OUTPUT_DIR, exist_ok=True)


def adsr_envelope(length):
    attack = int(length * 0.05)
    release = int(length * 0.1)
    sustain = length - attack - release

    env = np.ones(length)

    if attack > 0:
        env[:attack] = np.linspace(0, 1, attack)

    if release > 0:
        env[-release:] = np.linspace(1, 0, release)

    return env


def waveform(frequency, duration, sample_rate=44100, wave_type='sine'):
    t = np.linspace(0, duration, int(sample_rate * duration), False)

    if wave_type == 'square':
        wave = np.sign(np.sin(2 * np.pi * frequency * t))
    elif wave_type == 'triangle':
        wave = 2 * np.abs(2 * ((t * frequency) % 1) - 1) - 1
    elif wave_type == 'sawtooth':
        wave = 2 * ((t * frequency) % 1) - 1
    else:
        wave = np.sin(2 * np.pi * frequency * t)

    env = adsr_envelope(len(wave))
    return wave * env


def mix_tracks(tracks):
    max_len = max(len(track) for track in tracks)

    padded = []
    for track in tracks:
        if len(track) < max_len:
            track = np.pad(track, (0, max_len - len(track)))
        padded.append(track)

    mixed = np.sum(padded, axis=0)

    max_val = np.max(np.abs(mixed))
    if max_val > 0:
        mixed = mixed / max_val

    return mixed


def save_wav(audio, sample_rate=44100):
    filename = f'{uuid.uuid4()}.wav'
    path = os.path.join(OUTPUT_DIR, filename)

    scaled = np.int16(audio * 32767)
    write(path, sample_rate, scaled)

    return filename, path
