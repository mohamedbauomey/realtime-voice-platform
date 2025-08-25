import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'demo@example.com',
        name: 'Demo User',
        plan: 'FREE',
        apiKey: 'demo-api-key-' + nanoid()
      }
    }),
    prisma.user.create({
      data: {
        email: 'pro@example.com',
        name: 'Pro User',
        plan: 'PRO',
        apiKey: 'pro-api-key-' + nanoid(),
        minutesUsed: 5000
      }
    }),
    prisma.user.create({
      data: {
        email: 'enterprise@example.com',
        name: 'Enterprise User',
        plan: 'ENTERPRISE',
        apiKey: 'enterprise-api-key-' + nanoid(),
        minutesUsed: 50000
      }
    })
  ]);

  console.log(`✓ Created ${users.length} users`);

  // Create test rooms
  const rooms = await Promise.all([
    prisma.room.create({
      data: {
        name: 'Demo Room',
        userId: users[0].id,
        maxParticipants: 10
      }
    }),
    prisma.room.create({
      data: {
        name: 'Team Meeting',
        userId: users[1].id,
        maxParticipants: 50
      }
    }),
    prisma.room.create({
      data: {
        name: 'Conference Hall',
        userId: users[2].id,
        maxParticipants: 100
      }
    })
  ]);

  console.log(`✓ Created ${rooms.length} rooms`);

  // Create test participants
  const participants = await Promise.all([
    prisma.participant.create({
      data: {
        roomId: rooms[0].id,
        userId: users[0].id,
        name: 'John Doe',
        isAgent: false
      }
    }),
    prisma.participant.create({
      data: {
        roomId: rooms[0].id,
        name: 'AI Assistant',
        isAgent: true
      }
    })
  ]);

  console.log(`✓ Created ${participants.length} participants`);

  // Create sample metrics
  for (const room of rooms) {
    await prisma.roomMetrics.create({
      data: {
        roomId: room.id,
        activeSpeakers: Math.floor(Math.random() * 5),
        packetLoss: Math.random() * 5,
        avgMos: 3.5 + Math.random() * 1.5,
        avgLatency: 20 + Math.random() * 80
      }
    });
  }

  console.log('✓ Created sample metrics');

  console.log('\n📋 Test Credentials:');
  console.log('====================');
  users.forEach(user => {
    console.log(`\n${user.name} (${user.plan})`);
    console.log(`  Email: ${user.email}`);
    console.log(`  API Key: ${user.apiKey}`);
  });

  console.log('\n✅ Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });