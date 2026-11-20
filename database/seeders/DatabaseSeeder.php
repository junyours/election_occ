<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    // ----- Tuning knobs (change here, not in the body) -----
    private const VOTERS_PER_COURSE = [
        'BSIT' => 18,
        'BSBA' => 17,
        'BEED' => 15,
    ];
    private const CANDIDATES_PER_COURSE = [
        'BSIT' => 8,
        'BSBA' => 6,
        'BEED' => 6,
    ];
    private const LIVE_COMMENTS_PER_ELECTION = 15;
    private const AUDIT_LOG_COUNT             = 30;

    // ✅ NEW — historical records
    private const RECORD_YEARS         = [2023, 2024];
    private const RECORD_TURNOUT_RATIO = 0.65; // 65% of eligible voters vote

    public function run(): void
    {
        $this->command->info('==========================================');
        $this->command->info('Starting OCC Election System Database Seeder');
        $this->command->info('==========================================');

        // ==================== 1. COURSES ====================
        $this->command->info("\n📚 Creating courses...");

        $courses = [
            ['course_code' => 'BSIT', 'course_name' => 'Bachelor of Science in Information Technology', 'department' => 'College of Computing'],
            ['course_code' => 'BEED', 'course_name' => 'Bachelor of Elementary Education',             'department' => 'College of Education'],
            ['course_code' => 'BSBA', 'course_name' => 'Bachelor of Science in Business Administration', 'department' => 'College of Business'],
        ];

        $courseIds = [];
        foreach ($courses as $course) {
            $courseIds[$course['course_code']] = DB::table('courses')->insertGetId([
                'course_code' => $course['course_code'],
                'course_name' => $course['course_name'],
                'department'  => $course['department'],
                'is_active'   => true,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
            $this->command->info("   ✓ Created {$course['course_code']}");
        }

        // ==================== 2. COURSE SECTIONS ====================
        $this->command->info("\n📖 Creating course sections...");

        $sections   = ['A', 'B'];
        $yearLevels = [1, 2, 3, 4];
        $sectionIds = [];

        foreach ($courseIds as $courseCode => $courseId) {
            foreach ($yearLevels as $yearLevel) {
                foreach ($sections as $section) {
                    $sectionIds["{$courseCode}-Y{$yearLevel}-{$section}"] = DB::table('course_sections')->insertGetId([
                        'course_id'    => $courseId,
                        'section_code' => $section,
                        'section_name' => "Section {$section}",
                        'year_level'   => $yearLevel,
                        'is_active'    => true,
                        'created_at'   => now(),
                        'updated_at'   => now(),
                    ]);
                }
            }
        }
        $this->command->info('   ✓ Created ' . count($sectionIds) . ' sections (3 courses × 4 years × 2 sections)');

        // ==================== 3. USERS ====================
        $this->command->info("\n👥 Creating users...");
        $usedStudentIds = [];

        $uniqueStudentId = function (string $prefix, int &$counter) use (&$usedStudentIds): string {
            $id = $prefix . str_pad((string) $counter, 3, '0', STR_PAD_LEFT);
            while (in_array($id, $usedStudentIds, true)) {
                $counter++;
                $id = $prefix . str_pad((string) $counter, 3, '0', STR_PAD_LEFT);
            }
            $usedStudentIds[] = $id;
            return $id;
        };

        // 3.1 Admin
        $adminId = DB::table('users')->insertGetId([
            'email'             => 'admin@occelection.com',
            'password_hash'     => Hash::make('admin123'),
            'first_name'        => 'System',
            'last_name'         => 'Admin',
            'id_no'             => 'ADMIN001',
            'course_id'         => $courseIds['BSIT'],
            'section_id'        => $sectionIds['BSIT-Y1-A'],
            'year_level'        => null,
            'role'              => 'admin',
            'is_active'         => true,
            'email_verified_at' => now(),
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);
        $usedStudentIds[] = 'ADMIN001';
        $this->command->info('   ✓ Created Admin (1)');

        // 3.2 COMELEC
        $comelecUsers = [
            ['email' => 'comelec@occelection.com',  'first_name' => 'Juan',  'last_name' => 'Dela Cruz', 'course' => 'BSIT', 'section' => 'A', 'year' => 3],
            ['email' => 'comelec2@occelection.com', 'first_name' => 'Maria', 'last_name' => 'Santos',    'course' => 'BSBA', 'section' => 'B', 'year' => 3],
        ];

        $counter = 1;
        foreach ($comelecUsers as $u) {
            DB::table('users')->insert([
                'email'             => $u['email'],
                'password_hash'     => Hash::make('comelec123'),
                'first_name'        => $u['first_name'],
                'last_name'         => $u['last_name'],
                'id_no'             => $uniqueStudentId('COM', $counter),
                'course_id'         => $courseIds[$u['course']],
                'section_id'        => $sectionIds["{$u['course']}-Y{$u['year']}-{$u['section']}"],
                'year_level'        => $u['year'],
                'role'              => 'comelec',
                'is_active'         => true,
                'email_verified_at' => now(),
                'created_at'        => now(),
                'updated_at'        => now(),
            ]);
            $counter++;
        }
        $this->command->info('   ✓ Created COMELEC users (2)');

        // 3.3 Voters
        $this->command->info("\n👥 Creating voter users...");

        $firstNames = ['John','Jane','Michael','Sarah','David','Emma','James','Sophia','Robert','Olivia',
            'William','Ava','Joseph','Mia','Thomas','Charlotte','Daniel','Amelia','Matthew','Harper',
            'Christopher','Evelyn','Andrew','Abigail','Joshua','Emily','Kevin','Elizabeth','Brian','Samantha',
            'Jason','Victoria','Ryan','Madison','Nicholas','Chloe','Eric','Grace','Tyler','Lily',
            'Brandon','Zoe','Dylan','Natalie','Cameron','Hannah','Justin','Alyssa','Nathan','Julia'];

        $lastNames = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
            'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
            'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
            'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
            'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts'];

        $allVoterIds = [];
        $globalCounter = 1;

        foreach (self::VOTERS_PER_COURSE as $courseCode => $count) {
            for ($i = 0; $i < $count; $i++) {
                $yearLevel = $yearLevels[array_rand($yearLevels)];
                $section   = $sections[array_rand($sections)];

                $firstName = $firstNames[array_rand($firstNames)];
                $lastName  = $lastNames[array_rand($lastNames)];

                $studentId = strtoupper(substr($courseCode, 0, 2)) . $yearLevel . $section . str_pad((string) $globalCounter, 2, '0', STR_PAD_LEFT);
                while (in_array($studentId, $usedStudentIds, true)) {
                    $globalCounter++;
                    $studentId = strtoupper(substr($courseCode, 0, 2)) . $yearLevel . $section . str_pad((string) $globalCounter, 2, '0', STR_PAD_LEFT);
                }
                $usedStudentIds[] = $studentId;

                $emailBase = strtolower($firstName . '.' . $lastName . $globalCounter);
                $email     = $emailBase . '@occ.edu.ph';
                $suffix    = 1;
                while (DB::table('users')->where('email', $email)->exists()) {
                    $email = $emailBase . $suffix . '@occ.edu.ph';
                    $suffix++;
                }

                $allVoterIds[] = DB::table('users')->insertGetId([
                    'email'             => $email,
                    'password_hash'     => Hash::make('voter123'),
                    'first_name'        => $firstName,
                    'last_name'         => $lastName,
                    'id_no'             => $studentId,
                    'course_id'         => $courseIds[$courseCode],
                    'section_id'        => $sectionIds["{$courseCode}-Y{$yearLevel}-{$section}"],
                    'year_level'        => $yearLevel,
                    'role'              => 'voter',
                    'is_active'         => true,
                    'email_verified_at' => now(),
                    'created_at'        => now(),
                    'updated_at'        => now(),
                ]);
                $globalCounter++;
            }
        }
        $this->command->info('   ✓ Created ' . count($allVoterIds) . ' voter users');

        // ==================== 3.4 PROMOTE CANDIDATES ====================
        $this->command->info("\n👤 Promoting some voters to candidates...");

        $candidateUserIdsByCourse = [];
        foreach (self::CANDIDATES_PER_COURSE as $courseCode => $limit) {
            $ids = DB::table('users')
                ->where('course_id', $courseIds[$courseCode])
                ->where('role', 'voter')
                ->orderBy('user_id')
                ->limit($limit)
                ->pluck('user_id')
                ->toArray();

            $candidateUserIdsByCourse[$courseCode] = $ids;

            foreach ($ids as $uid) {
                DB::table('users')->where('user_id', $uid)->update(['role' => 'candidate']);
            }
        }

        $totalCandidates = array_sum(array_map('count', $candidateUserIdsByCourse));
        $this->command->info("   ✓ Promoted {$totalCandidates} voters to candidate role");

        // ==================== 4. ELECTIONS (CURRENT) ====================
        $this->command->info("\n🗳️ Creating elections...");

        $now         = Carbon::now();
        $currentYear = $now->year;

        $elections = [
            [
                'title'        => "CSG General Election {$currentYear}",
                'election_type'=> 'CSG',
                'year'         => $currentYear,
                'description'  => 'Central Student Government General Election for all students.',
                'voting_start' => $now->copy()->startOfDay(),
                'voting_end'   => $now->copy()->endOfDay()->addDays(5),
                'course_id'    => null,
            ],
            [
                'title'        => "BSIT SBO Election {$currentYear}",
                'election_type'=> 'SBO',
                'year'         => $currentYear,
                'description'  => 'BSIT Student Body Organization Election for IT students.',
                'voting_start' => $now->copy()->addDays(7)->startOfDay(),
                'voting_end'   => $now->copy()->addDays(8)->endOfDay(),
                'course_id'    => $courseIds['BSIT'],
            ],
            [
                'title'        => "BSBA SBO Election {$currentYear}",
                'election_type'=> 'SBO',
                'year'         => $currentYear,
                'description'  => 'BSBA Student Body Organization Election for Business students.',
                'voting_start' => $now->copy()->addDays(7)->startOfDay(),
                'voting_end'   => $now->copy()->addDays(8)->endOfDay(),
                'course_id'    => $courseIds['BSBA'],
            ],
            [
                'title'        => "BEED SBO Election {$currentYear}",
                'election_type'=> 'SBO',
                'year'         => $currentYear,
                'description'  => 'BEED Student Body Organization Election for Education students.',
                'voting_start' => $now->copy()->addDays(7)->startOfDay(),
                'voting_end'   => $now->copy()->addDays(8)->endOfDay(),
                'course_id'    => $courseIds['BEED'],
            ],
        ];

        $electionIds = [];
        foreach ($elections as $e) {
            $electionIds[$e['title']] = DB::table('elections')->insertGetId([
                'title'              => $e['title'],
                'election_type'      => $e['election_type'],
                'year'               => $e['year'],
                'description'        => $e['description'],
                'voting_start'       => $e['voting_start'],
                'voting_end'         => $e['voting_end'],
                'created_by_user_id' => $adminId,
                'course_id'          => $e['course_id'],
                'is_active'          => true,
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);
            $this->command->info("   ✓ Created: {$e['title']} (Year: {$e['year']})");
        }

        // ==================== 5. POSITIONS ====================
        $this->command->info("\n📋 Creating positions...");

        $csgPositions = [
            ['title' => 'CSG President',                                   'category' => 'Executive',   'order' => 1,  'position_type' => 'executive'],
            ['title' => 'CSG Vice President',                              'category' => 'Executive',   'order' => 2,  'position_type' => 'executive'],
            ['title' => 'General Secretary',                               'category' => 'Secretariat', 'order' => 3,  'position_type' => 'secretary'],
            ['title' => 'Secretary of Budget and Finance',                 'category' => 'Secretariat', 'order' => 4,  'position_type' => 'secretary'],
            ['title' => 'Secretary of Sports',                             'category' => 'Secretariat', 'order' => 5,  'position_type' => 'secretary'],
            ['title' => 'Secretary of Press and Publication',              'category' => 'Secretariat', 'order' => 6,  'position_type' => 'secretary'],
            ['title' => 'Secretary of External Affairs',                   'category' => 'Secretariat', 'order' => 7,  'position_type' => 'secretary'],
            ['title' => 'Senate President Chair on Budget and Appropriation','category'=> 'Senate',      'order' => 8,  'position_type' => 'senator'],
            ['title' => 'Senator Chair on Publication',                    'category' => 'Senate',      'order' => 9,  'position_type' => 'senator'],
            ['title' => 'Senator Chair on Cultural Music and Arts',        'category' => 'Senate',      'order' => 10, 'position_type' => 'senator'],
            ['title' => 'Senator Chair on Sports',                         'category' => 'Senate',      'order' => 11, 'position_type' => 'senator'],
            ['title' => 'Senator Chair on Literary',                       'category' => 'Senate',      'order' => 12, 'position_type' => 'senator'],
            ['title' => "Senator Chair on Student's Welfare and Environment", 'category'=> 'Senate',    'order' => 13, 'position_type' => 'senator'],
        ];

        $sboPositions = [
            ['title' => 'Governor',      'category' => 'Executive',   'order' => 1, 'position_type' => 'executive'],
            ['title' => 'Vice Governor', 'category' => 'Executive',   'order' => 2, 'position_type' => 'executive'],
            ['title' => 'Secretary',     'category' => 'Secretariat', 'order' => 3, 'position_type' => 'secretary'],
            ['title' => 'Treasurer',     'category' => 'Finance',     'order' => 4, 'position_type' => 'finance'],
            ['title' => 'Auditor',       'category' => 'Finance',     'order' => 5, 'position_type' => 'finance'],
        ];

        $allPositions = [];
        $positionIds  = [];

        foreach ($csgPositions as $p) {
            $allPositions[] = [
                'election_title' => "CSG General Election {$currentYear}",
                'title'          => $p['title'],
                'category'       => $p['category'],
                'order'          => $p['order'],
                'max_winners'    => 1,
                'position_type'  => $p['position_type'],
            ];
        }

        foreach (['BSIT', 'BSBA', 'BEED'] as $courseCode) {
            foreach ($sboPositions as $p) {
                $allPositions[] = [
                    'election_title' => "{$courseCode} SBO Election {$currentYear}",
                    'title'          => $p['title'],
                    'category'       => $p['category'],
                    'order'          => $p['order'],
                    'max_winners'    => 1,
                    'position_type'  => $p['position_type'],
                ];
            }
        }

        foreach ($allPositions as $p) {
            $electionId = $electionIds[$p['election_title']];
            $positionIds[$p['election_title']][$p['title']] = DB::table('positions')->insertGetId([
                'election_id'     => $electionId,
                'title'           => $p['title'],
                'category'        => $p['category'],
                'order_in_ballot' => $p['order'],
                'max_winners'     => $p['max_winners'],
                'position_type'   => $p['position_type'],
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);
        }
        $this->command->info('   ✓ Created ' . count($allPositions) . ' positions (13 CSG + 5 SBO × 3 courses)');

        // ==================== 6. PARTYLISTS ====================
        $this->command->info("\n🎭 Creating partylists...");

        $partylistsData = [
            ['election' => "CSG General Election {$currentYear}", 'name' => 'Bagong Sigla', 'description' => 'New energy for student governance.',        'platform' => 'Innovation, transparency, and student welfare'],
            ['election' => "CSG General Election {$currentYear}", 'name' => 'Sama-Sama',    'description' => 'Unity and progress for all.',                  'platform' => 'Unity, inclusivity, and academic excellence'],
            ['election' => "CSG General Election {$currentYear}", 'name' => 'Aksyon',       'description' => 'Action-driven leadership.',                    'platform' => 'Proactive solutions and student empowerment'],
            ['election' => "CSG General Election {$currentYear}", 'name' => 'Pagbabago',    'description' => 'Change for a better future.',                  'platform' => 'Reform, innovation, and progress'],
            ['election' => "BSIT SBO Election {$currentYear}",    'name' => 'Tech Leaders',  'description' => 'Leading BSIT to excellence.',                  'platform' => 'Tech innovation and student development'],
            ['election' => "BSIT SBO Election {$currentYear}",    'name' => 'Code for Change','description'=> 'Innovation through technology.',               'platform' => 'Coding skills and career preparation'],
            ['election' => "BSIT SBO Election {$currentYear}",    'name' => 'IT Innovators', 'description' => 'Driving IT excellence.',                       'platform' => 'Innovation, collaboration, and success'],
            ['election' => "BSBA SBO Election {$currentYear}",    'name' => 'Business Visionaries','description'=>'Shaping future business leaders.',       'platform' => 'Entrepreneurship and industry connections'],
            ['election' => "BSBA SBO Election {$currentYear}",    'name' => 'Empower Biz',    'description' => 'Empowering business students.',                'platform' => 'Financial literacy and leadership'],
            ['election' => "BSBA SBO Election {$currentYear}",    'name' => 'Future Executives','description'=>"Building tomorrow's business leaders.",   'platform' => 'Professional development and career readiness'],
            ['election' => "BEED SBO Election {$currentYear}",    'name' => 'Future Educators','description'=>'Building future educators for tomorrow.',     'platform' => 'Academic excellence and teacher development'],
            ['election' => "BEED SBO Election {$currentYear}",    'name' => 'Teach Lead',     'description' => 'Leading the next generation of teachers.',      'platform' => 'Innovation in education and student support'],
            ['election' => "BEED SBO Election {$currentYear}",    'name' => 'EduVision',      'description' => 'Vision for excellence in education.',           'platform' => 'Empowering future teachers through collaboration'],
        ];

        $partylistIds = [];
        foreach ($partylistsData as $pl) {
            $electionId = $electionIds[$pl['election']];
            $partylistIds[$pl['election']][$pl['name']] = DB::table('partylists')->insertGetId([
                'election_id'         => $electionId,
                'name'                => $pl['name'],
                'description'         => $pl['description'],
                'platform'            => $pl['platform'],
                'created_by_user_id'  => $adminId,
                'approved_by_user_id' => $adminId,
                'created_at'          => now(),
                'updated_at'          => now(),
            ]);
        }
        $this->command->info('   ✓ Created ' . count($partylistsData) . ' partylists');

        // ==================== 7. ELECTION PARTICIPATIONS (lazy) ====================
        $this->command->info("\n📝 Seeding sample election participations...");

        $csgElectionId = $electionIds["CSG General Election {$currentYear}"];
        $sampleVoters  = array_slice($allVoterIds, 0, 20);

        foreach ($sampleVoters as $i => $voterId) {
            DB::table('election_participations')->insert([
                'election_id'        => $csgElectionId,
                'user_id'            => $voterId,
                'has_voted'          => true,
                'voted_at'           => now()->subMinutes(rand(1, 240)),
                'sanction_eligible'  => false,
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);
        }
        $this->command->info('   ✓ Seeded ' . count($sampleVoters) . ' sample participations in CSG election');

        // ==================== 8. CANDIDATES (CURRENT) ====================
        $this->command->info("\n🗳️ Creating candidates...");

        $bsitCandidates = $candidateUserIdsByCourse['BSIT'];
        $bsbaCandidates = $candidateUserIdsByCourse['BSBA'];
        $beedCandidates = $candidateUserIdsByCourse['BEED'];

        $allCandidates = [];

        $csgElection = "CSG General Election {$currentYear}";
        if (count($bsitCandidates) >= 2) {
            foreach ([0, 1] as $i) {
                $allCandidates[] = [
                    'user_id'       => $bsitCandidates[$i],
                    'election'      => $csgElection,
                    'position'      => 'CSG President',
                    'platform'      => $i === 0
                        ? 'A platform for change and progress. I will focus on student welfare, transparency, and academic excellence.'
                        : 'Unity and inclusivity for all students. I will work to create a better learning environment for everyone.',
                    'qualifications'=> $i === 0
                        ? "Former class president, dean's lister, and active student leader with 3 years of service."
                        : 'Student council officer, volunteer leader, and active community organizer.',
                    'partylist'     => $i === 0 ? 'Bagong Sigla' : 'Sama-Sama',
                ];
            }
        }
        if (count($bsbaCandidates) >= 2) {
            foreach ([0, 1] as $i) {
                $allCandidates[] = [
                    'user_id'       => $bsbaCandidates[$i],
                    'election'      => $csgElection,
                    'position'      => 'CSG Vice President',
                    'platform'      => $i === 0
                        ? "Supporting the president's vision while ensuring student voices are heard."
                        : 'Empowering students through effective leadership and representation.',
                    'qualifications'=> $i === 0
                        ? 'Student leader with 2 years of experience in student government.'
                        : 'Former student council secretary and active advocate for student rights.',
                    'partylist'     => $i === 0 ? 'Aksyon' : 'Pagbabago',
                ];
            }
        }
        if (count($beedCandidates) >= 2) {
            foreach ([0, 1] as $i) {
                $allCandidates[] = [
                    'user_id'       => $beedCandidates[$i],
                    'election'      => $csgElection,
                    'position'      => 'General Secretary',
                    'platform'      => $i === 0
                        ? 'Transparency and efficiency in student government operations.'
                        : 'Improving communication and documentation for student government.',
                    'qualifications'=> $i === 0
                        ? 'Former class secretary with excellent organizational skills.'
                        : 'Student leader with experience in administrative roles.',
                    'partylist'     => $i === 0 ? 'Bagong Sigla' : 'Sama-Sama',
                ];
            }
        }

        $courseCandidateMap = [
            'BSIT' => [$bsitCandidates, 'Tech Leaders', 'Code for Change', 'IT Innovators'],
            'BSBA' => [$bsbaCandidates, 'Business Visionaries', 'Empower Biz', 'Future Executives'],
            'BEED' => [$beedCandidates, 'Future Educators', 'Teach Lead', 'EduVision'],
        ];

        foreach ($courseCandidateMap as $courseCode => [$ids, $pl1, $pl2, $pl3]) {
            if (count($ids) < 4) {
                continue;
            }

            $electionTitle = "{$courseCode} SBO Election {$currentYear}";

            $allCandidates[] = [
                'user_id'       => $ids[0],
                'election'      => $electionTitle,
                'position'      => 'Governor',
                'platform'      => "Leading {$courseCode} to excellence through innovation and collaboration.",
                'qualifications'=> 'Student leader with strong project management experience.',
                'partylist'     => $pl1,
            ];
            $allCandidates[] = [
                'user_id'       => $ids[1],
                'election'      => $electionTitle,
                'position'      => 'Governor',
                'platform'      => "Empowering {$courseCode} students with skills for the future.",
                'qualifications'=> 'Active member of student organizations and community leader.',
                'partylist'     => $pl2,
            ];
            $allCandidates[] = [
                'user_id'       => $ids[2],
                'election'      => $electionTitle,
                'position'      => 'Vice Governor',
                'platform'      => 'Supporting student initiatives and fostering a strong community.',
                'qualifications'=> 'Student leader with passion for innovation.',
                'partylist'     => $pl3,
            ];
            $allCandidates[] = [
                'user_id'       => $ids[3],
                'election'      => $electionTitle,
                'position'      => 'Vice Governor',
                'platform'      => 'Building bridges between students and administration.',
                'qualifications'=> 'Former class officer with strong leadership skills.',
                'partylist'     => $pl1,
            ];

            if (count($ids) >= 5) {
                $allCandidates[] = [
                    'user_id'       => $ids[4],
                    'election'      => $electionTitle,
                    'position'      => 'Secretary',
                    'platform'      => 'Efficient documentation and communication for student government.',
                    'qualifications'=> 'Excellent organizational and writing skills.',
                    'partylist'     => $pl2,
                ];
            }
        }

        $candidateIds = [];
        $candidateIdByUserElection = [];

        foreach ($allCandidates as $c) {
            $electionId = $electionIds[$c['election']];
            $positionId = $positionIds[$c['election']][$c['position']] ?? null;

            if (!$positionId) {
                $this->command->warn("   ⚠ Skipping candidate: position '{$c['position']}' not found in '{$c['election']}'");
                continue;
            }

            $cid = DB::table('candidates')->insertGetId([
                'user_id'             => $c['user_id'],
                'election_id'         => $electionId,
                'position_id'         => $positionId,
                'platform'            => $c['platform'],
                'qualifications'      => $c['qualifications'],
                'photo_url'           => null,
                'is_approved'         => true,
                'approved_by_user_id' => $adminId,
                'approved_at'         => now(),
                'created_at'          => now(),
                'updated_at'          => now(),
            ]);

            $candidateIds[] = $cid;
            $candidateIdByUserElection[$c['user_id']][$electionId] = $cid;

            $plId = $partylistIds[$c['election']][$c['partylist']] ?? null;
            if ($plId) {
                DB::table('partylist_memberships')->insert([
                    'partylist_id'         => $plId,
                    'candidate_id'         => $cid,
                    'status'               => 'approved',
                    'approved_at'          => now(),
                    'approved_by_user_id'  => $adminId,
                    'is_active'            => true,
                    'created_at'           => now(),
                    'updated_at'           => now(),
                ]);
            }
        }
        $this->command->info('   ✓ Created ' . count($candidateIds) . ' candidates with partylist memberships');

        // ==================== 9. FEEDBACK CATEGORIES ====================
        $this->command->info("\n💬 Creating feedback categories...");

        $categories = [
            ['name' => 'Website Experience',     'description' => 'Feedback about the website usability and design',   'order' => 1],
            ['name' => 'Voting Process',         'description' => 'Feedback about the voting experience',              'order' => 2],
            ['name' => 'Candidate Information',  'description' => 'Feedback about candidate details and platforms',    'order' => 3],
            ['name' => 'Overall Satisfaction',   'description' => 'General feedback about the election',               'order' => 4],
        ];

        foreach ($categories as $cat) {
            DB::table('feedback_categories')->insert([
                'category_name' => $cat['name'],
                'description'   => $cat['description'],
                'display_order' => $cat['order'],
                'is_active'     => true,
                'created_at'    => now(),
                'updated_at'    => now(),
            ]);
        }
        $this->command->info('   ✓ Created ' . count($categories) . ' feedback categories');

        // ==================== 10. LIVE COMMENTS ====================
        $this->command->info("\n💬 Creating live comments...");

        $sampleComments = [
            'Great election!', 'Good luck to all candidates!', 'Easy voting process!',
            'Very organized election.', 'Proud to vote!', 'Transparent and fair!',
            'More power to the organizers!', 'Excited for the results!',
            'Best election system ever!', 'I love the new voting system!',
            'Smooth and hassle-free voting.', 'Kudos to all candidates!',
            'Vote wisely!', 'Excited for the new leaders!', 'Thank you for this opportunity!',
        ];

        $commentCount = 0;
        foreach ($electionIds as $electionId) {
            $participantIds = DB::table('election_participations')
                ->where('election_id', $electionId)
                ->pluck('user_id')
                ->toArray();

            if (empty($participantIds)) {
                $participantIds = array_slice($allVoterIds, 0, self::LIVE_COMMENTS_PER_ELECTION);
            }

            $selected = array_slice($participantIds, 0, self::LIVE_COMMENTS_PER_ELECTION);
            foreach ($selected as $userId) {
                DB::table('live_comments')->insert([
                    'election_id'  => $electionId,
                    'user_id'      => $userId,
                    'comment_text' => $sampleComments[array_rand($sampleComments)],
                    'is_visible'   => true,
                    'created_at'   => now()->subMinutes(rand(1, 120)),
                    'updated_at'   => now(),
                ]);
                $commentCount++;
            }
        }
        $this->command->info("   ✓ Created {$commentCount} live comments");

        // ==================== 11. AUDIT LOGS ====================
        $this->command->info("\n📜 Creating audit logs...");

        $actionTypes = [
            'LOGIN', 'REGISTER', 'CREATE_ELECTION', 'CAST_VOTE',
            'APPROVE_CANDIDATE', 'MOBILE_VOTE_CAST', 'UPDATE_USER',
        ];

        $auditUserPool = array_merge([$adminId], $allVoterIds);
        $electionIdValues = array_values($electionIds);

        for ($i = 0; $i < self::AUDIT_LOG_COUNT; $i++) {
            DB::table('audit_logs')->insert([
                'user_id'      => $auditUserPool[array_rand($auditUserPool)],
                'action_type'  => $actionTypes[array_rand($actionTypes)],
                'target_table' => 'elections',
                'target_id'    => $electionIdValues[array_rand($electionIdValues)],
                'ip_address'   => '127.0.0.1',
                'user_agent'   => 'Mozilla/5.0 (Seeder)',
                'timestamp'    => now()->subDays(rand(1, 10))->subHours(rand(1, 23)),
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);
        }
        $this->command->info('   ✓ Created ' . self::AUDIT_LOG_COUNT . ' audit logs');

        // ==================== 12. ✅ ELECTION RECORDS (HISTORICAL) ====================
        $this->command->info("\n📚 Seeding historical election records...");
        $recordStats = $this->seedElectionRecords(
            $courseIds,
            $adminId,
            $allVoterIds,
            $candidateUserIdsByCourse,
        );

        // ==================== 13. SUMMARY ====================
        $this->command->info("\n==========================================");
        $this->command->info('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
        $this->command->info("==========================================\n");

        $this->command->info('📊 FINAL SUMMARY:');
        $this->command->info('   • Courses: 3 (BSIT, BEED, BSBA)');
        $this->command->info('   • Sections: ' . count($sectionIds) . ' (3 courses × 4 years × 2 sections)');
        $this->command->info('   • Users: 1 Admin + 2 COMELEC + ' . count($allVoterIds) . ' Voters/Candidates');
        $this->command->info("   • Candidates: {$totalCandidates} (promoted from voters)");
        $this->command->info('   • Elections (current): 4 (1 CSG + 3 SBO) — Year: ' . $currentYear);
        $this->command->info('   • Positions: ' . count($allPositions));
        $this->command->info('   • Partylists: ' . count($partylistsData));
        $this->command->info('   • Approved candidates: ' . count($candidateIds));
        $this->command->info('   • Live comments: ' . $commentCount);
        $this->command->info('   • Audit logs: ' . self::AUDIT_LOG_COUNT);
        $this->command->info('   • Sample participations (CSG): ' . count($sampleVoters));

        // ✅ Historical records summary
        $this->command->info('   • Historical years seeded: ' . implode(', ', self::RECORD_YEARS));
        $this->command->info('   • Historical elections: ' . $recordStats['elections']);
        $this->command->info('   • Historical candidates: ' . $recordStats['candidates']);
        $this->command->info('   • Historical votes: ' . $recordStats['votes']);
        $this->command->info('   • Historical receipts: ' . $recordStats['receipts']);

        $this->command->info("\n🔑 LOGIN CREDENTIALS:");
        $this->command->info('   ┌─────────────────────────────────────────────────────────────┐');
        $this->command->info('   │ Admin:     admin@occelection.com / admin123                 │');
        $this->command->info('   │ COMELEC:   comelec@occelection.com / comelec123             │');
        $this->command->info('   │ Voter:     Any @occ.edu.ph email / voter123                 │');
        $this->command->info('   └─────────────────────────────────────────────────────────────┘');

        $this->command->info("\n📌 NOTE:");
        $this->command->info('   • Passwords are for demonstration only.');
        $this->command->info('   • All candidates are pre-approved.');
        $this->command->info('   • election_participations is the source of truth for "has voted".');
        $this->command->info('   • Only 20 sample CSG participations were seeded — new votes create rows automatically.');
        $this->command->info('   • CSG is open to all courses; each SBO is scoped to its own course.');
        $this->command->info('   • ✅ Historical records are seeded for years ' . implode(', ', self::RECORD_YEARS) . ' — check the Election Records admin page.');
        $this->command->info("==========================================\n");
    }

    // ============================================================
    // ✅ HISTORICAL ELECTION RECORDS
    // ============================================================
    /**
     * Seed past elections so the Election Records admin page has data.
     *
     * For each year in RECORD_YEARS:
     *   - 1 CSG + 3 SBO elections (all ended in that year)
     *   - positions for each election (same structure as current)
     *   - candidates for each election (sampled from the candidate pool)
     *   - ~RECORD_TURNOUT_RATIO of eligible voters marked as voted
     *   - Votes cast for each voting participation
     *   - DigitalReceipt for each voter who voted
     */
    private function seedElectionRecords(
        array $courseIds,
        int $adminId,
        array $allVoterIds,
        array $candidateUserIdsByCourse,
    ): array {
        $summary = [
            'elections'  => 0,
            'candidates' => 0,
            'votes'      => 0,
            'receipts'   => 0,
        ];

        // Voting ended mid-year so `is_finished()` = true
        $recordMonthDay = ['03-15', '03-16']; // voting_start, voting_end (single-day-ish)

        foreach (self::RECORD_YEARS as $year) {
            $this->command->info("\n   📅 Year {$year}");

            // Build the 4 elections for this year
            $electionsForYear = [
                [
                    'title'        => "CSG General Election {$year}",
                    'election_type'=> 'CSG',
                    'description'  => "Central Student Government General Election for all students ({$year}).",
                    'course_id'    => null,
                ],
                [
                    'title'        => "BSIT SBO Election {$year}",
                    'election_type'=> 'SBO',
                    'description'  => "BSIT Student Body Organization Election ({$year}).",
                    'course_id'    => $courseIds['BSIT'],
                ],
                [
                    'title'        => "BSBA SBO Election {$year}",
                    'election_type'=> 'SBO',
                    'description'  => "BSBA Student Body Organization Election ({$year}).",
                    'course_id'    => $courseIds['BSBA'],
                ],
                [
                    'title'        => "BEED SBO Election {$year}",
                    'election_type'=> 'SBO',
                    'description'  => "BEED Student Body Organization Election ({$year}).",
                    'course_id'    => $courseIds['BEED'],
                ],
            ];

            $votingStart = Carbon::createFromFormat('Y-m-d H:i:s', "{$year}-{$recordMonthDay[0]} 08:00:00");
            $votingEnd   = Carbon::createFromFormat('Y-m-d H:i:s', "{$year}-{$recordMonthDay[1]} 17:00:00");
            $votedAt     = $votingStart->copy()->addHours(3); // realistic vote time

            // Positions map for this year
            $csgPositionTitles = [
                'CSG President', 'CSG Vice President', 'General Secretary',
                'Secretary of Budget and Finance', 'Secretary of Sports',
                'Secretary of Press and Publication', 'Secretary of External Affairs',
                'Senate President Chair on Budget and Appropriation',
                'Senator Chair on Publication',
                'Senator Chair on Cultural Music and Arts',
                'Senator Chair on Sports',
                'Senator Chair on Literary',
                "Senator Chair on Student's Welfare and Environment",
            ];
            $sboPositionTitles = [
                'Governor', 'Vice Governor', 'Secretary', 'Treasurer', 'Auditor',
            ];

            // Create elections + positions
            $yearElectionIds  = [];
            $yearPositionIds  = [];

            foreach ($electionsForYear as $i => $e) {
                $electionId = DB::table('elections')->insertGetId([
                    'title'              => $e['title'],
                    'election_type'      => $e['election_type'],
                    'year'               => $year,
                    'description'        => $e['description'],
                    'voting_start'       => $votingStart,
                    'voting_end'         => $votingEnd,
                    'created_by_user_id' => $adminId,
                    'course_id'          => $e['course_id'],
                    'is_active'          => false, // archived
                    'created_at'         => $votingStart->copy()->subDays(7),
                    'updated_at'         => $votingEnd,
                ]);
                $yearElectionIds[$e['title']] = $electionId;
                $summary['elections']++;

                // Positions
                $positionTitles = $e['election_type'] === 'CSG'
                    ? $csgPositionTitles
                    : $sboPositionTitles;

                foreach ($positionTitles as $idx => $title) {
                    $yearPositionIds[$e['title']][$title] = DB::table('positions')->insertGetId([
                        'election_id'     => $electionId,
                        'title'           => $title,
                        'category'        => $idx < 2 ? 'Executive' : 'Other',
                        'order_in_ballot' => $idx + 1,
                        'max_winners'     => 1,
                        'position_type'   => 'other',
                        'created_at'      => now(),
                        'updated_at'      => now(),
                    ]);
                }
            }

            // Candidates — sample from pool
            $yearCandidatesByElection = [];
            foreach ($yearElectionIds as $title => $electionId) {
                $isCSG = str_starts_with($title, 'CSG');
                $isSBO = !$isCSG;

                // Determine which candidate pool to draw from
                if ($isCSG) {
                    $pool = array_merge(
                        $candidateUserIdsByCourse['BSIT'],
                        $candidateUserIdsByCourse['BSBA'],
                        $candidateUserIdsByCourse['BEED'],
                    );
                } else {
                    $courseCode = explode(' ', $title)[0];
                    $pool = $candidateUserIdsByCourse[$courseCode] ?? [];
                }

                if (empty($pool)) continue;

                shuffle($pool);
                $take = min(3, count($pool));

                $positionTitles = array_keys($yearPositionIds[$title]);
                $electionCandidates = [];

                for ($i = 0; $i < $take; $i++) {
                    $uid       = $pool[$i];
                    $positionTitle = $positionTitles[$i % count($positionTitles)];
                    $positionId    = $yearPositionIds[$title][$positionTitle];

                    // Skip duplicate (same user + same election)
                    $exists = DB::table('candidates')
                        ->where('user_id', $uid)
                        ->where('election_id', $electionId)
                        ->exists();
                    if ($exists) continue;

                    $cid = DB::table('candidates')->insertGetId([
                        'user_id'             => $uid,
                        'election_id'         => $electionId,
                        'position_id'         => $positionId,
                        'platform'            => "Campaign platform for {$year} election.",
                        'qualifications'      => "Qualified candidate for {$year}.",
                        'photo_url'           => null,
                        'is_approved'         => true,
                        'approved_by_user_id' => $adminId,
                        'approved_at'         => $votingStart->copy()->subDays(2),
                        'created_at'          => $votingStart->copy()->subDays(30),
                        'updated_at'          => $votingStart->copy()->subDays(2),
                    ]);

                    $electionCandidates[] = [
                        'candidate_id' => $cid,
                        'position_id'  => $positionId,
                        'user_id'      => $uid,
                    ];
                    $summary['candidates']++;
                }

                $yearCandidatesByElection[$electionId] = $electionCandidates;
            }

            // ---------- Votes + Participations + Receipts ----------
            foreach ($yearElectionIds as $title => $electionId) {
                $isSBO = str_starts_with($title, 'SBO') || str_contains($title, ' SBO ');
                $isCSG = str_starts_with($title, 'CSG');

                // Determine eligible voters
                if ($isCSG) {
                    $eligible = $allVoterIds;
                } else {
                    // SBO — only voters from that course
                    $courseCode = explode(' ', $title)[0];
                    $courseId   = $courseIds[$courseCode] ?? null;
                    if (!$courseId) continue;

                    $eligible = DB::table('users')
                        ->where('course_id', $courseId)
                        ->whereIn('role', ['voter', 'candidate'])
                        ->pluck('user_id')
                        ->toArray();
                }

                if (empty($eligible)) continue;

                shuffle($eligible);
                $voterCount  = max(3, (int) floor(count($eligible) * self::RECORD_TURNOUT_RATIO));
                $votersToVote = array_slice($eligible, 0, $voterCount);
                $candidates   = $yearCandidatesByElection[$electionId] ?? [];

                foreach ($votersToVote as $uid) {
                    // Participation row
                    DB::table('election_participations')->insert([
                        'election_id'       => $electionId,
                        'user_id'           => $uid,
                        'has_voted'         => true,
                        'voted_at'          => $votedAt,
                        'sanction_eligible' => false,
                        'created_at'        => $votedAt,
                        'updated_at'        => $votedAt,
                    ]);

                    // Digital receipt
                    $receiptCode = 'VOTE-' . strtoupper(Str::random(16));
                    DB::table('digital_receipts')->insert([
                        'election_id'   => $electionId,
                        'user_id'       => $uid,
                        'receipt_code'  => $receiptCode,
                        'sent_to_email' => 'voter' . $uid . '@occ.edu.ph',
                        'generated_at'  => $votedAt,
                        'created_at'    => $votedAt,
                        'updated_at'    => $votedAt,
                    ]);
                    $summary['receipts']++;

                    // Votes — one per position
                    foreach ($candidates as $c) {
                        DB::table('votes')->insert([
                            'election_id'  => $electionId,
                            'user_id'      => $uid,
                            'candidate_id' => $c['candidate_id'],
                            'position_id'  => $c['position_id'],
                            'timestamp'    => $votedAt,
                            'created_at'   => $votedAt,
                            'updated_at'   => $votedAt,
                        ]);
                        $summary['votes']++;
                    }
                }

                $this->command->info(
                    "      ✓ {$title}: {$voterCount} voters, " .
                    count($candidates) . ' candidates'
                );
            }
        }

        return $summary;
    }
}