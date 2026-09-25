<?php
// database/migrations/0001_01_03_000000_create_election_activity_tables.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ============================================================
        // ELECTION PARTICIPATIONS
        // Lazy "has voted" ledger — one row per user × election,
        // created on-demand when a user casts their first vote.
        // ============================================================
        Schema::create('election_participations', function (Blueprint $table) {
            $table->id('participation_id');
            $table->foreignId('election_id')
                ->constrained('elections', 'election_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->boolean('has_voted')->default(false);
            $table->timestamp('voted_at')->nullable();
            $table->boolean('sanction_eligible')->default(false);
            $table->timestamps();

            $table->unique(['election_id', 'user_id'], 'uk_election_participation');
            $table->index('has_voted');
            $table->index('sanction_eligible');
            $table->index('voted_at');
        });

        // ============================================================
        // VOTES — linked to users directly
        // ============================================================
        Schema::create('votes', function (Blueprint $table) {
            $table->id('vote_id');

            $table->foreignId('election_id')
                ->constrained('elections', 'election_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->foreignId('candidate_id')
                ->constrained('candidates', 'candidate_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->foreignId('position_id')
                ->constrained('positions', 'position_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->timestamp('timestamp')->useCurrent();
            $table->timestamps();

            // One vote per user per position per election
            $table->unique(['user_id', 'position_id', 'election_id'], 'uk_user_position_election');

            $table->index('timestamp');
            $table->index('candidate_id');
            $table->index('position_id');
            $table->index('election_id');
        });

        // ============================================================
        // DIGITAL RECEIPTS — per user per election
        // ============================================================
        Schema::create('digital_receipts', function (Blueprint $table) {
            $table->id('receipt_id');

            $table->foreignId('election_id')
                ->constrained('elections', 'election_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->string('receipt_code', 64)->unique();
            $table->string('sent_to_email', 100);
            $table->timestamp('generated_at')->useCurrent();
            $table->timestamps();

            $table->unique(['election_id', 'user_id'], 'uk_receipt_election_user');
            $table->index('receipt_code');
            $table->index('generated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('digital_receipts');
        Schema::dropIfExists('votes');
        Schema::dropIfExists('election_participations');
    }
};