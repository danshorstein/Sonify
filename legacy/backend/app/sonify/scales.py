import numpy as np

SCALES = {
    'major_pentatonic': [0, 2, 4, 7, 9],
    'minor_pentatonic': [0, 3, 5, 7, 10],
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'chromatic': list(range(12)),
}

NOTE_MAP = {
    'C': 0,
    'C#': 1,
    'D': 2,
    'D#': 3,
    'E': 4,
    'F': 5,
    'F#': 6,
    'G': 7,
    'G#': 8,
    'A': 9,
    'A#': 10,
    'B': 11,
}


def note_name_to_midi(note: str) -> int:
    pitch = note[:-1]
    octave = int(note[-1])
    return NOTE_MAP[pitch] + ((octave + 1) * 12)


def midi_to_frequency(midi: int) -> float:
    return 440.0 * (2 ** ((midi - 69) / 12))


def value_to_frequency(value, min_value, max_value, scale_name='major_pentatonic', pitch_range=('C3', 'C5')):
    scale = SCALES[scale_name]

    low = note_name_to_midi(pitch_range[0])
    high = note_name_to_midi(pitch_range[1])

    normalized = 0.5
    if max_value != min_value:
        normalized = (value - min_value) / (max_value - min_value)

    midi_span = high - low
    scale_steps = []

    for octave in range((midi_span // 12) + 2):
        for step in scale:
            scale_steps.append(low + step + octave * 12)

    scale_steps = [x for x in scale_steps if low <= x <= high]

    index = int(np.clip(normalized * (len(scale_steps) - 1), 0, len(scale_steps) - 1))

    return midi_to_frequency(scale_steps[index])
