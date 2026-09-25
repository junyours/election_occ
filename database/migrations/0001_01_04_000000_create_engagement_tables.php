<?php
// database/migrations/0001_01_04_000000_create_engagement_tables.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ============================================================
        // CAMPAIGN SCHEDULES
        // ============================================================
        Schema::create('campaign_schedules', function (Blueprint $table) {
            $table->id('schedule_id');
            $table->foreignId('election_id')
                ->constrained('elections', 'election_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('section_id')
                ->constrained('course_sections', 'section_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->datetime('start_time');
            $table->datetime('end_time');
            $table->foreignId('candidate_id')
                ->nullable()
                ->constrained('candidates', 'candidate_id')
                ->onDelete('set null')
                ->onUpdate('cascade');
            $table->text('notes')->nullable();
            $table->enum('status', ['pending', 'ongoing', 'completed', 'cancelled'])->default('pending');
            $table->foreignId('created_by_user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->timestamps();

            $table->unique(['section_id', 'start_time'], 'uk_section_schedule');
            $table->index(['start_time', 'end_time']);
            $table->index('status');
        });

        // ============================================================
        // CAMPAIGN SCHEDULE REQUESTS
        // ============================================================
        Schema::create('campaign_schedule_requests', function (Blueprint $table) {
            $table->id('request_id');
            $table->foreignId('candidate_id')
                ->constrained('candidates', 'candidate_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('election_id')
                ->constrained('elections', 'election_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('section_id')
                ->constrained('course_sections', 'section_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->date('preferred_date');
            $table->time('preferred_start_time');
            $table->time('preferred_end_time');
            $table->text('message')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'rescheduled'])->default('pending');
            $table->text('admin_remarks')->nullable();
            $table->foreignId('processed_by_user_id')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null')
                ->onUpdate('cascade');
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index('candidate_id');
            $table->index('election_id');
            $table->index('section_id');
            $table->index('status');
            $table->index('preferred_date');
        });

        // ============================================================
        // CANDIDACY APPLICATIONS
        // ============================================================
        Schema::create('candidacy_applications', function (Blueprint $table) {
            $table->id('application_id');
            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('election_id')
                ->constrained('elections', 'election_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->json('form_data');
            $table->foreignId('selected_partylist_id')
                ->nullable()
                ->constrained('partylists', 'partylist_id')
                ->onDelete('set null');
            $table->enum('admin_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->timestamp('admin_approved_at')->nullable();
            $table->foreignId('admin_approved_by_user_id')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null')
                ->onUpdate('cascade');
            $table->string('recommendation_letter_path')->nullable();
            $table->boolean('letter_generated')->default(false);
            $table->text('admin_remarks')->nullable();
            $table->timestamps();

            $table->index(['election_id', 'admin_status']);
            $table->unique(['user_id', 'election_id'], 'uk_user_election_application');
        });

        // ============================================================
        // CAMPAIGN POSTS
        // ============================================================
        Schema::create('campaign_posts', function (Blueprint $table) {
            $table->id('post_id');
            $table->foreignId('candidate_id')
                ->nullable()
                ->constrained('candidates', 'candidate_id')
                ->onDelete('set null')
                ->onUpdate('cascade');
            $table->foreignId('election_id')
                ->constrained('elections', 'election_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->text('content');
            $table->string('type')->default('survey');
            $table->string('title')->nullable();
            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('views')->default(0);
            $table->timestamps();

            $table->index('candidate_id');
            $table->index('election_id');
            $table->index('type');
            $table->index('created_at');
        });

        // ============================================================
        // POST COMMENTS
        // ============================================================
        Schema::create('post_comments', function (Blueprint $table) {
            $table->id('comment_id');
            $table->foreignId('post_id')
                ->constrained('campaign_posts', 'post_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->text('content');
            $table->boolean('is_visible')->default(true);
            $table->timestamps();

            $table->index('post_id');
            $table->index('user_id');
        });

        // ============================================================
        // POST REACTIONS
        // ============================================================
        Schema::create('post_reactions', function (Blueprint $table) {
            $table->id('reaction_id');
            $table->foreignId('post_id')
                ->constrained('campaign_posts', 'post_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->enum('type', [
                'like',
                'heart',
                'laugh',
                'wow',
                'sad',
                'angry',
                'insightful',
                'helpful',
            ])->default('like');
            $table->timestamps();

            $table->unique(['post_id', 'user_id'], 'uk_post_user_reaction');
        });

        // ============================================================
        // LIVE COMMENTS
        // ============================================================
        Schema::create('live_comments', function (Blueprint $table) {
            $table->id('comment_id');
            $table->foreignId('election_id')
                ->constrained('elections', 'election_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->text('comment_text');
            $table->boolean('is_visible')->default(true);
            $table->foreignId('moderated_by_user_id')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null')
                ->onUpdate('cascade');
            $table->timestamp('moderated_at')->nullable();
            $table->timestamps();

            $table->index('is_visible');
            $table->index('election_id');
        });

        // ============================================================
        // FEEDBACK CATEGORIES
        // ============================================================
        Schema::create('feedback_categories', function (Blueprint $table) {
            $table->id('category_id');
            $table->string('category_name', 50)->unique();
            $table->text('description')->nullable();
            $table->integer('display_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('is_active');
            $table->index('display_order');
        });

        // ============================================================
        // FEEDBACK
        // ============================================================
        Schema::create('feedback', function (Blueprint $table) {
            $table->id('feedback_id');
            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('election_id')
                ->constrained('elections', 'election_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('category_id')
                ->nullable()
                ->constrained('feedback_categories', 'category_id')
                ->onDelete('set null')
                ->onUpdate('cascade');
            $table->integer('rating')->unsigned();
            $table->string('title', 255)->nullable();
            $table->text('comment');
            $table->boolean('is_public')->default(true);
            $table->boolean('is_anonymous')->default(false);
            $table->text('admin_response')->nullable();
            $table->foreignId('responded_by_user_id')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null')
                ->onUpdate('cascade');
            $table->timestamp('responded_at')->nullable();
            $table->integer('helpful_count')->default(0);
            $table->timestamps();

            $table->index('rating');
            $table->index('is_public');
            $table->index('election_id');
        });

        // ============================================================
        // FEEDBACK HELPFUL VOTES
        // ============================================================
        Schema::create('feedback_helpful_votes', function (Blueprint $table) {
            $table->id('vote_id');
            $table->foreignId('feedback_id')
                ->constrained('feedback', 'feedback_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->timestamps();

            $table->unique(['feedback_id', 'user_id'], 'uk_user_feedback');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_helpful_votes');
        Schema::dropIfExists('feedback');
        Schema::dropIfExists('feedback_categories');
        Schema::dropIfExists('live_comments');
        Schema::dropIfExists('post_reactions');
        Schema::dropIfExists('post_comments');
        Schema::dropIfExists('campaign_posts');
        Schema::dropIfExists('candidacy_applications');
        Schema::dropIfExists('campaign_schedule_requests');
        Schema::dropIfExists('campaign_schedules');
    }
};