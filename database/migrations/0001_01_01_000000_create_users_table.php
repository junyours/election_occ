<?php
// database/migrations/0001_01_01_000000_create_users_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ============================================================
        // COURSES
        // ============================================================
        Schema::create('courses', function (Blueprint $table) {
            $table->id('course_id');
            $table->string('course_code', 20)->unique();
            $table->string('course_name', 100);
            $table->string('department', 100)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('course_code');
            $table->index('department');
        });

        // ============================================================
        // COURSE SECTIONS
        // ============================================================
        Schema::create('course_sections', function (Blueprint $table) {
            $table->id('section_id');
            $table->foreignId('course_id')
                ->constrained('courses', 'course_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->string('section_code', 10);
            $table->string('section_name', 50);
            $table->integer('year_level')->unsigned();
            $table->integer('capacity')->default(60);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['course_id', 'section_code', 'year_level'], 'uk_course_section_year');
            $table->index(['course_id', 'year_level']);
        });

        // ============================================================
        // USERS
        // ============================================================
        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('email', 100)->unique();
            $table->string('password_hash');
            $table->string('otp_code', 6)->nullable();
            $table->timestamp('otp_expires_at')->nullable();
            $table->timestamp('otp_last_sent_at')->nullable();
            $table->boolean('two_factor_enabled')->default(false);
            $table->string('first_name', 50);
            $table->string('last_name', 50);
            $table->string('id_no', 20)->unique()->nullable();

            $table->foreignId('course_id')
                ->nullable()
                ->constrained('courses', 'course_id')
                ->onDelete('set null')
                ->onUpdate('cascade');

            $table->foreignId('section_id')
                ->nullable()
                ->constrained('course_sections', 'section_id')
                ->onDelete('set null')
                ->onUpdate('cascade');

            $table->integer('year_level')->nullable();

            // ✅ Personal info
            $table->date('birthdate')->nullable();
            $table->string('present_address', 255)->nullable();
            $table->string('present_address_2', 255)->nullable();
            $table->integer('no_unit_load')->nullable();
            $table->string('cellphone', 20)->nullable();
            $table->string('social_media', 100)->nullable();

            $table->json('face_encoding_front')->nullable();
            $table->json('face_encoding_left')->nullable();
            $table->json('face_encoding_right')->nullable();
            $table->json('face_encoding')->nullable();
            $table->boolean('is_face_registered')->default(false);
            $table->timestamp('face_registered_at')->nullable();
            $table->string('face_version', 16)->default('mobilefacenet-v1');
            $table->string('profile_photo')->nullable();

            // Account
            $table->enum('role', ['admin', 'comelec', 'candidate', 'voter'])->default('voter');
            $table->boolean('is_active')->default(true);
            $table->timestamp('email_verified_at')->nullable();
            $table->rememberToken();
            $table->timestamps();

            $table->index('email');
            $table->index('role');
            $table->index('id_no');
            $table->index('course_id');
            $table->index('section_id');
            $table->index('year_level');
            $table->index('is_active');
            $table->index('is_face_registered');
            $table->index('cellphone');
            $table->index('birthdate');
            $table->index('otp_code');
        });

        // ============================================================
        // PASSWORD RESET TOKENS
        // ============================================================
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email', 100)->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
            $table->timestamp('expires_at')->nullable();

            $table->index('token');
        });

        // ============================================================
        // SESSIONS
        // ============================================================
        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        // ============================================================
        // CACHE
        // ============================================================
        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->integer('expiration');
            $table->index('expiration');
        });

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->integer('expiration');
            $table->index('expiration');
        });

        // ============================================================
        // JOBS
        // ============================================================
        Schema::create('jobs', function (Blueprint $table) {
            $table->id();
            $table->string('queue')->index();
            $table->longText('payload');
            $table->unsignedSmallInteger('attempts');
            $table->unsignedInteger('reserved_at')->nullable();
            $table->unsignedInteger('available_at');
            $table->unsignedInteger('created_at');
        });

        Schema::create('failed_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('uuid')->unique();
            $table->text('connection');
            $table->text('queue');
            $table->longText('payload');
            $table->longText('exception');
            $table->timestamp('failed_at')->useCurrent();
        });

        // ============================================================
        // PERSONAL ACCESS TOKENS (Sanctum)
        // ============================================================
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index('tokenable_type');
            $table->index('tokenable_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('failed_jobs');
        Schema::dropIfExists('jobs');
        Schema::dropIfExists('cache_locks');
        Schema::dropIfExists('cache');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
        Schema::dropIfExists('course_sections');
        Schema::dropIfExists('courses');
    }
};
