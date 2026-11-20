<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $data->title }} — Results</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #222; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        h2 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { border: 1px solid #ddd; padding: 5px 6px; text-align: left; }
        th { background: #f2f2f2; font-weight: 700; font-size: 10px; text-transform: uppercase; }
        tr:nth-child(even) td { background: #fafafa; }
        .meta { color: #666; font-size: 10px; }
        .winner { background: #d1fae5; font-weight: 700; }
    </style>
</head>
<body>
    <h1>Opol Community College — {{ $data->title }}</h1>
    <div class="meta">
        {{ $data->election_type }} &middot; {{ ucfirst($data->status) }} &middot;
        {{ \Carbon\Carbon::parse($data->voting_start)->format('M d, Y') }} – {{ \Carbon\Carbon::parse($data->voting_end)->format('M d, Y') }}
    </div>

    @forelse ($data->positions ?? [] as $pos)
        <h2>{{ $pos->title }}</h2>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Candidate</th>
                    <th>Partylist</th>
                    <th>Votes</th>
                    <th>Result</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($pos->candidates as $i => $c)
                    <tr class="{{ $c->winner ? 'winner' : '' }}">
                        <td>{{ $i + 1 }}</td>
                        <td>{{ trim(($c->first_name ?? '') . ' ' . ($c->last_name ?? '')) }}</td>
                        <td>{{ $c->partylist_name ?? 'Independent' }}</td>
                        <td>{{ $c->votes }}</td>
                        <td>{{ $c->winner ? 'WINNER' : '' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @empty
        <p>No positions found.</p>
    @endforelse
</body>
</html>