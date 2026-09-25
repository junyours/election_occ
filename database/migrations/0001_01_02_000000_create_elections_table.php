<?php
// database/migrations/0001_01_02_000000_create_elections_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ============================================================
        // ELECTIONS
        // ============================================================
        Schema::create('elections', function (Blueprint $table) {
            $table->id('election_id');
            $table->string('title', 100);
            $table->enum('election_type', ['CSG', 'SBO'])->default('CSG');
            $table->integer('year')->nullable();
            $table->text('description')->nullable();
            $table->datetime('voting_start');
            $table->datetime('voting_end');
            $table->boolean('is_active')->default(false);

            $table->foreignId('created_by_user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->foreignId('course_id')
                ->nullable()
                ->constrained('courses', 'course_id')
                ->onDelete('set null')
                ->onUpdate('cascade');

            $table->timestamps();

            $table->index('is_active');
            $table->index('election_type');
            $table->index(['voting_start', 'voting_end']);
            $table->index('created_by_user_id');
        });

        // ============================================================
        // POSITIONS
        // ============================================================
        Schema::create('positions', function (Blueprint $table) {
            $table->id('position_id');
            $table->foreignId('election_id')
                ->constrained('elections', 'election_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->string('title', 100);
            $table->enum('position_type', [
                'executive',
                'secretary',
                'senator',
                'governor',
                'finance',
                'other',
            ])->default('other');
            $table->string('category', 50);
            $table->integer('order_in_ballot');
            $table->integer('max_winners')->default(1);
            $table->text('description')->nullable();
            $table->timestamps();

            $table->unique(['election_id', 'title'], 'uk_election_position');
            $table->index('category');
            $table->index('order_in_ballot');
            $table->index('position_type');
        });

        // ============================================================
        // PARTYLISTS
        // ============================================================
        Schema::create('partylists', function (Blueprint $table) {
            $table->id('partylist_id');
            $table->foreignId('election_id')
                ->constrained('elections', 'election_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->string('name', 100);
            $table->text('logo_url')->nullable();
            $table->text('description')->nullable();
            $table->text('platform')->nullable();

            $table->foreignId('created_by_user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->foreignId('approved_by_user_id')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null')
                ->onUpdate('cascade');

            $table->timestamps();

            $table->unique(['election_id', 'name'], 'uk_election_partylist');
            $table->index('name');
            $table->index('created_by_user_id');
        });

        // ============================================================
        // CANDIDATES
        // ============================================================
        Schema::create('candidates', function (Blueprint $table) {
            $table->id('candidate_id');
            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('election_id')
                ->constrained('elections', 'election_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('position_id')
                ->constrained('positions', 'position_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->text('platform');
            $table->text('qualifications');
            $table->text('photo_url')->nullable();
            $table->boolean('is_approved')->default(false);

            $table->foreignId('approved_by_user_id')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null')
                ->onUpdate('cascade');

            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'election_id'], 'uk_user_election');
            $table->index('is_approved');
            $table->index('position_id');
            $table->index('election_id');
        });

        // ============================================================
        // PARTYLIST MEMBERSHIPS
        // ============================================================
        Schema::create('partylist_memberships', function (Blueprint $table) {
            $table->id('membership_id');
            $table->foreignId('partylist_id')
                ->constrained('partylists', 'partylist_id')
                ->onDelete('cascade');
            $table->foreignId('candidate_id')
                ->constrained('candidates', 'candidate_id')
                ->onDelete('cascade');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by_user_id')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['partylist_id', 'candidate_id'], 'uk_partylist_candidate');
            $table->index('partylist_id');
            $table->index('candidate_id');
            $table->index('status');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partylist_memberships');
        Schema::dropIfExists('candidates');
        Schema::dropIfExists('partylists');
        Schema::dropIfExists('positions');
        Schema::dropIfExists('elections');
    }
};
