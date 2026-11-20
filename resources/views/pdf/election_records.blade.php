<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Election Records {{ $year }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #222; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        h2 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { border: 1px solid #ddd; padding: 5px 6px; text-align: left; }
        th { background: #f2f2f2; font-weight: 700; font-size: 10px; text-transform: uppercase; }
        tr:nth-child(even) td { background: #fafafa; }
        .meta { color: #666; font-size: 10px; }
    </style>
</head>
<body>
    <h1>Opol Community College — Election Records</h1>
    <div class="meta">
        Year: {{ $year }} &middot; Generated: {{ now()->format('F d, Y g:i A') }}
    </div>

    <h2>Elections ({{ $data->total_elections ?? 0 }})</h2>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Candidates</th>
                <th>Voters</th>
                <th>Voted</th>
                <th>Turnout</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($data->elections ?? [] as $i => $e)
                <tr>
                    <td>{{ $i + 1 }}</td>
                    <td>{{ $e->title }}</td>
                    <td>{{ $e->election_type }}</td>
                    <td>{{ ucfirst($e->status) }}</td>
                    <td>{{ $e->candidates_count }}</td>
                    <td>{{ $e->voters_total }}</td>
                    <td>{{ $e->voters_voted }}</td>
                    <td>{{ $e->turnout_percentage }}%</td>
                </tr>
            @empty
                <tr><td colspan="8" style="text-align:center;">No elections found.</td></tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>