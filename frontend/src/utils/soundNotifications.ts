/**
 * Notification utility for timer transitions
 * Includes both sound notifications (Web Audio API) and browser notifications
 */

// Browser Notification Functions

export function showBrowserNotification(title: string, body: string) {
  // Check if browser notifications are enabled
  const notificationsEnabled = localStorage.getItem('browserNotifications') === 'true';
  if (!notificationsEnabled) return;

  // Check if browser supports notifications
  if (!('Notification' in window)) {
    console.warn('Browser notifications not supported');
    return;
  }

  // Check permission status
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'pomodoro-timer',
      requireInteraction: false,
    });
  } else if (Notification.permission !== 'denied') {
    // Request permission if not denied
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'pomodoro-timer',
          requireInteraction: false,
        });
      }
    });
  }
}

export function notifyWorkPeriodComplete() {
  showBrowserNotification(
    '☕ Break Time!',
    'Great work! Time for a well-deserved break.'
  );
}

export function notifyBreakPeriodComplete() {
  showBrowserNotification(
    '💪 Back to Work!',
    'Break is over. Ready to focus again?'
  );
}

export function notifyAllCyclesComplete() {
  showBrowserNotification(
    '🎉 Pomodoro Complete!',
    'All cycles finished! Great job staying focused.'
  );
}

// Sound Notification Functions

export function playNotificationSound() {
  // Check if sound notifications are enabled
  const soundEnabled = localStorage.getItem('soundNotifications') === 'true';
  if (!soundEnabled) return;

  // Create audio context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);

  // Beep pattern: 4 beeps, each 0.3s long with 0.4s gaps
  const beeps = [
    { start: 0, duration: 0.3 },
    { start: 0.7, duration: 0.3 },
    { start: 1.4, duration: 0.3 },
    { start: 2.1, duration: 0.3 },
  ];

  const beepFrequency = 880; // A5 note - classic beep sound

  beeps.forEach((beep) => {
    const osc = audioContext.createOscillator();
    const beepGain = audioContext.createGain();

    osc.connect(beepGain);
    beepGain.connect(gainNode);

    // Square wave for more digital/beep-like sound
    osc.type = 'square';
    osc.frequency.setValueAtTime(beepFrequency, audioContext.currentTime + beep.start);

    // Sharp attack and release for beep sound
    const attackTime = 0.01;
    const releaseTime = 0.05;
    const beepVolume = 0.2;

    beepGain.gain.setValueAtTime(0, audioContext.currentTime + beep.start);
    beepGain.gain.linearRampToValueAtTime(beepVolume, audioContext.currentTime + beep.start + attackTime);
    beepGain.gain.setValueAtTime(beepVolume, audioContext.currentTime + beep.start + beep.duration - releaseTime);
    beepGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + beep.start + beep.duration);

    osc.start(audioContext.currentTime + beep.start);
    osc.stop(audioContext.currentTime + beep.start + beep.duration);
  });

  // Clean up after sound completes
  setTimeout(() => {
    audioContext.close();
  }, 3000);
}

export function playCompletionSound() {
  // Check if sound notifications are enabled
  const soundEnabled = localStorage.getItem('soundNotifications') === 'true';
  if (!soundEnabled) return;

  // Create audio context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);

  // Completion beep pattern: 3 short beeps, pause, then 3 longer beeps
  const beeps = [
    // First set: 3 quick beeps
    { start: 0, duration: 0.2 },
    { start: 0.35, duration: 0.2 },
    { start: 0.7, duration: 0.2 },
    // Pause
    // Second set: 3 longer beeps
    { start: 1.4, duration: 0.5 },
    { start: 2.1, duration: 0.5 },
    { start: 2.8, duration: 0.8 },
  ];

  const beepFrequency = 1000; // Slightly higher pitch for completion

  beeps.forEach((beep) => {
    const osc = audioContext.createOscillator();
    const beepGain = audioContext.createGain();

    osc.connect(beepGain);
    beepGain.connect(gainNode);

    // Square wave for digital beep sound
    osc.type = 'square';
    osc.frequency.setValueAtTime(beepFrequency, audioContext.currentTime + beep.start);

    // Sharp attack and release
    const attackTime = 0.01;
    const releaseTime = 0.05;
    const beepVolume = 0.2;

    beepGain.gain.setValueAtTime(0, audioContext.currentTime + beep.start);
    beepGain.gain.linearRampToValueAtTime(beepVolume, audioContext.currentTime + beep.start + attackTime);
    beepGain.gain.setValueAtTime(beepVolume, audioContext.currentTime + beep.start + beep.duration - releaseTime);
    beepGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + beep.start + beep.duration);

    osc.start(audioContext.currentTime + beep.start);
    osc.stop(audioContext.currentTime + beep.start + beep.duration);
  });

  // Clean up after sound completes
  setTimeout(() => {
    audioContext.close();
  }, 4000);
}
