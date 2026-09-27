<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PostReaction extends Model
{
    use HasFactory;

    protected $primaryKey = 'reaction_id';

    protected $fillable = [
        'post_id',
        'user_id',
        'type',
    ];

    protected $appends = ['user_name', 'user_photo'];

    public function post()
    {
        return $this->belongsTo(CampaignPost::class, 'post_id', 'post_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    /**
     * Convenience accessors so the frontend doesn't need to dig into
     * the full user object just to render a name or avatar.
     */
    public function getUserNameAttribute(): ?string
    {
        if (!$this->user) return null;
        return trim(($this->user->first_name ?? '') . ' ' . ($this->user->last_name ?? ''));
    }

    public function getUserPhotoAttribute(): ?string
    {
        return $this->user?->profile_photo;
    }
}
