import numpy as np
import pandas as pd

from .audio import waveform, mix_tracks, save_wav
from .scales import value_to_frequency
from .vegalite import extract_data, detect_chart_type, extract_encodings

WAVEFORMS = ['sine', 'triangle', 'square', 'sawtooth']


class VegaLiteSonifier:
    def __init__(self, spec, options):
        self.spec = spec
        self.options = options

    def compile(self):
        chart_type = detect_chart_type(self.spec)
        encodings = extract_encodings(self.spec)
        data = pd.DataFrame(extract_data(self.spec))

        if chart_type == 'bar':
            return self._compile_bar(data, encodings)

        if chart_type == 'line':
            return self._compile_line(data, encodings)

        raise ValueError(f'Unsupported chart type: {chart_type}')

    def _compile_bar(self, data, encodings):
        y_field = encodings['y']['field']

        values = data[y_field].tolist()

        track = []

        for value in values:
            freq = value_to_frequency(
                value,
                min(values),
                max(values),
                self.options.scale,
                self.options.pitch_range,
            )

            note = waveform(freq, 0.35, self.options.sample_rate, 'sine')
            silence = np.zeros(int(self.options.sample_rate * 0.05))
            track.extend(note)
            track.extend(silence)

        mixed = np.array(track)

        filename, _ = save_wav(mixed, self.options.sample_rate)

        return {
            'audio_file': filename,
            'summary': f'Bar chart with {len(values)} bars.',
            'mapping': {
                'x': 'time order',
                'y': 'pitch',
            },
        }

    def _compile_line(self, data, encodings):
        y_field = encodings['y']['field']
        color_field = encodings.get('color', {}).get('field')

        tracks = []

        if color_field:
            groups = list(data.groupby(color_field))
        else:
            groups = [('series', data)]

        global_min = data[y_field].min()
        global_max = data[y_field].max()

        for idx, (name, subset) in enumerate(groups):
            values = subset[y_field].tolist()
            wave_type = WAVEFORMS[idx % len(WAVEFORMS)]

            audio = []

            for value in values:
                freq = value_to_frequency(
                    value,
                    global_min,
                    global_max,
                    self.options.scale,
                    self.options.pitch_range,
                )

                tone = waveform(
                    freq,
                    0.25,
                    self.options.sample_rate,
                    wave_type,
                )

                audio.extend(tone * 0.2)

            tracks.append(np.array(audio))

        mixed = mix_tracks(tracks)

        filename, _ = save_wav(mixed, self.options.sample_rate)

        return {
            'audio_file': filename,
            'summary': f'Line chart with {len(groups)} series.',
            'mapping': {
                'x': 'time',
                'y': 'pitch',
                'color': 'waveform',
            },
        }
