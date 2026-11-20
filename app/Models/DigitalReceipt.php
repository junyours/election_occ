<?php
// app/Models/DigitalReceipt.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DigitalReceipt extends Model
{
    protected $primaryKey = 'receipt_id';

    protected $fillable = [
        'election_id',
        'user_id',
        'receipt_code',
        'sent_to_email',
        'generated_at',
    ];

    protected $casts = [
        'generated_at' => 'datetime',
    ];

    public function election()
    {
        return $this->belongsTo(Election::class, 'election_id', 'election_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}