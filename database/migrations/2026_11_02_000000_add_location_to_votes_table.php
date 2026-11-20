<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('votes', function (Blueprint $table) {
            // Store the location the ballot was cast from.
            // All nullable — a vote must never fail just because GPS
            // was unavailable or the user denied permission.
            $table->decimal('vote_latitude', 10, 7)->nullable()->after('timestamp');
            $table->decimal('vote_longitude', 10, 7)->nullable()->after('vote_latitude');
            $table->decimal('vote_accuracy', 8, 2)->nullable()->after('vote_longitude');
            $table->string('vote_address', 255)->nullable()->after('vote_accuracy');
            $table->string('vote_source', 20)->nullable()->after('vote_address'); // 'gps' | 'manual' | null
        });
    }

    public function down(): void
    {
        Schema::table('votes', function (Blueprint $table) {
            $table->dropColumn([
                'vote_latitude',
                'vote_longitude',
                'vote_accuracy',
                'vote_address',
                'vote_source',
            ]);
        });
    }
};