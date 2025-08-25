// Quick test to verify WebSocket and room functionality
import { io } from 'socket.io-client';

console.log('🧪 Testing Voice Platform Connection...\n');

// Connect to server
const socket = io('http://localhost:8080');

socket.on('connect', () => {
    console.log('✅ Connected to server');
    console.log(`   Socket ID: ${socket.id}`);
    
    // Join a test room
    socket.emit('join-room', {
        roomId: 'test-room-123',
        name: 'Test User'
    });
});

socket.on('joined-room', (data) => {
    console.log('✅ Joined room successfully');
    console.log(`   Room: ${data.roomId}`);
    console.log(`   Participant ID: ${data.participantId}`);
    
    // Simulate another user joining
    setTimeout(() => {
        const socket2 = io('http://localhost:8080');
        socket2.on('connect', () => {
            socket2.emit('join-room', {
                roomId: 'test-room-123',
                name: 'Test User 2'
            });
        });
    }, 1000);
});

socket.on('participant-joined', (data) => {
    console.log('✅ Another participant joined');
    console.log(`   Name: ${data.name}`);
    
    // Success - disconnect after test
    setTimeout(() => {
        console.log('\n🎉 All tests passed!');
        console.log('   Platform is working correctly');
        process.exit(0);
    }, 1000);
});

socket.on('error', (error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
});

// Timeout if test takes too long
setTimeout(() => {
    console.error('❌ Test timeout');
    process.exit(1);
}, 10000);