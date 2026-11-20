<?php
// app/Models/Vote.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Vote extends Model
{
    use HasFactory;

    protected $primaryKey = 'vote_id';

    protected $fillable = [
        'election_id',
        'user_id',
        'candidate_id',
        'position_id',
        'timestamp',

        // ✅ location captured at vote time
        'vote_latitude',
        'vote_longitude',
        'vote_accuracy',
        'vote_address',
        'vote_source',
    ];

    protected $casts = [
        'timestamp'      => 'datetime',
        'vote_latitude'  => 'float',
        'vote_longitude' => 'float',
        'vote_accuracy'  => 'float',
    ];

    public $timestamps = false;

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function candidate()
    {
        return $this->belongsTo(Candidate::class, 'candidate_id', 'candidate_id');
    }

    public function position()
    {
        return $this->belongsTo(Position::class, 'position_id', 'position_id');
    }

    public function election()
    {
        return $this->belongsTo(Election::class, 'election_id', 'election_id');
    }
}