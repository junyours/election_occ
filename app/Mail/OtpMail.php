<?php
// app/Mail/OtpMail.php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $userName,
        public string $otpCode,
        public int $ttlMinutes = 5,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your OCC Election Login Code',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.otp',
            with: [
                'userName'   => $this->userName,
                'otpCode'    => $this->otpCode,
                'ttlMinutes' => $this->ttlMinutes,
            ],
        );
    }
}