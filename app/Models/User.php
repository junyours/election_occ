<?php
// app/Models/User.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Carbon\Carbon;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $primaryKey = 'user_id';

    protected $fillable = [
        'email',
        'password_hash',
        'first_name',
        'last_name',
        'id_no',
        'course_id',
        'section_id',
        'year_level',
        'birthdate',
        'present_address',
        'present_address_2',
        'no_unit_load',
        'cellphone',
        'social_media',
        'profile_photo',
        'face_encoding_front',
        'face_encoding_left',
        'face_encoding_right',
        'face_encoding',
        'is_face_registered',
        'face_registered_at',
        'face_version',
        'role',
        'is_active',
        'email_verified_at',
        'otp_code',
        'otp_expires_at',
        'otp_last_sent_at',
        'two_factor_enabled',
    ];

    protected $hidden = [
        'password_hash',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at'   => 'datetime',
        'is_face_registered'  => 'boolean',
        'is_active'           => 'boolean',
        'course_id'           => 'integer',
        'face_registered_at'  => 'datetime',
        'face_encoding_front' => 'array',
        'face_encoding_left'  => 'array',
        'face_encoding_right' => 'array',
        'face_encoding'       => 'array',
        'birthdate'           => 'date',
        'no_unit_load'        => 'integer',
        'otp_expires_at'    => 'datetime',
        'otp_last_sent_at'  => 'datetime',
        'two_factor_enabled' => 'boolean',
    ];

    protected $appends = ['age', 'full_name'];

    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    public function course()
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function section()
    {
        return $this->belongsTo(CourseSection::class, 'section_id');
    }

    public function candidates()
    {
        return $this->hasMany(Candidate::class, 'user_id');
    }

    public function participations()
    {
        return $this->hasMany(ElectionParticipation::class, 'user_id', 'user_id');
    }

    public function votes()
    {
        return $this->hasMany(Vote::class, 'user_id', 'user_id');
    }

    public function digitalReceipts()
    {
        return $this->hasMany(DigitalReceipt::class, 'user_id', 'user_id');
    }

    // ============================================================
    // FACE RECOGNITION HELPERS
    // ============================================================

    public function hasPoseEmbeddings(): bool
    {
        return !empty($this->face_encoding_front)
            && !empty($this->face_encoding_left)
            && !empty($this->face_encoding_right);
    }

    public function hasAnyFaceData(): bool
    {
        return $this->is_face_registered
            || !empty($this->face_encoding_front)
            || !empty($this->profile_photo);
    }

    // ============================================================
    // COMPUTED ATTRIBUTES
    // ============================================================

    public function getAgeAttribute(): ?int
    {
        if (!$this->birthdate) {
            return null;
        }
        return Carbon::parse($this->birthdate)->age;
    }

    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    /**
     * Generate a fresh 6-digit OTP for this user.
     */
    public function generateOtp(int $ttlMinutes = 5): string
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $this->otp_code         = $code;
        $this->otp_expires_at   = now()->addMinutes($ttlMinutes);
        $this->otp_last_sent_at = now();
        $this->save();

        return $code;
    }

    public function hasValidOtp(string $code): bool
    {
        return $this->otp_code
            && $this->otp_expires_at
            && $this->otp_code === $code
            && now()->lessThanOrEqualTo($this->otp_expires_at);
    }

    public function clearOtp(): void
    {
        $this->otp_code         = null;
        $this->otp_expires_at   = null;
        $this->otp_last_sent_at = null;
        $this->save();
    }
}
