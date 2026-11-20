<?php
// database/migrations/0001_01_05_000000_create_system_tables.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ============================================================
        // SYSTEM SETTINGS
        // ============================================================
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id('setting_id');
            $table->string('setting_key', 100)->unique();
            $table->text('setting_value')->nullable();
            $table->enum('setting_type', [
                'string',
                'integer',
                'boolean',
                'json',
                'array',
            ])->default('string');
            $table->text('description')->nullable();
            $table->foreignId('updated_by_user_id')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null')
                ->onUpdate('cascade');
            $table->timestamps();

            $table->index('setting_key');
        });

        // ============================================================
        // USER SESSIONS (for tracking logins)
        // ============================================================
        Schema::create('user_sessions', function (Blueprint $table) {
            $table->id('session_id');
            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->string('session_token')->unique();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('device_type', 50)->nullable();
            $table->timestamp('login_time')->useCurrent();
            $table->timestamp('logout_time')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('is_active');
            $table->index('login_time');
        });

        // ============================================================
        // AUDIT LOGS
        // ============================================================
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id('log_id');
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null')
                ->onUpdate('cascade');
            $table->string('action_type', 50);
            $table->string('target_table', 50)->nullable();
            $table->unsignedBigInteger('target_id')->nullable();
            $table->json('old_value')->nullable();
            $table->json('new_value')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('timestamp')->useCurrent();
            $table->timestamps();

            $table->index('action_type');
            $table->index(['target_table', 'target_id']);
            $table->index('timestamp');
            $table->index('user_id');
        });

        // ============================================================
        // NOTIFICATIONS
        // ============================================================
        Schema::create('notifications', function (Blueprint $table) {
            $table->id('notification_id');
            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade');
            $table->string('title', 255);
            $table->text('message');
            $table->enum('type', [
                'election_reminder',
                'vote_confirmation',
                'candidate_approval',
                'feedback_response',
                'system',
            ])->default('system');
            $table->boolean('is_read')->default(false);
            $table->json('data')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_read']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('system_settings');
    }
};