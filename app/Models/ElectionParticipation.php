<?php
// app/Models/ElectionParticipation.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ElectionParticipation extends Model
{
    use HasFactory;

    protected $primaryKey = 'participation_id';

    protected $fillable = [
        'election_id',
        'user_id',
        'has_voted',
        'voted_at',
        'sanction_eligible',
    ];

    protected $casts = [
        'has_voted' => 'boolean',
        'sanction_eligible' => 'boolean',
        'voted_at' => 'datetime',
    ];

    public function election()
    {
        return $this->belongsTo(Election::class, 'election_id', 'election_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function scopeVoted($query)
    {
        return $query->where('has_voted', true);
    }

    public function scopeNotVoted($query)
    {
        return $query->where('has_voted', false);
    }

    public function scopeForElection($query, $electionId)
    {
        return $query->where('election_id', $electionId);
    }

    public static function ensure(int $electionId, int $userId): self
    {
        return self::firstOrCreate(
            [
                'election_id' => $electionId,
                'user_id' => $userId,
            ],
            [
                'has_voted' => false,
                'sanction_eligible' => false,
            ]
        );
    }
}