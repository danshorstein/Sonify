def extract_data(spec: dict):
    data = spec.get('data', {})

    if 'values' not in data:
        raise ValueError('Only inline Vega-Lite data.values supported for MVP')

    return data['values']


def detect_chart_type(spec: dict):
    mark = spec.get('mark')

    if isinstance(mark, dict):
        mark = mark.get('type')

    return mark


def extract_encodings(spec: dict):
    return spec.get('encoding', {})
