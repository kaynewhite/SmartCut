import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const realtimeDisabled = import.meta.env.VITE_DISABLE_REALTIME === 'true';
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (realtimeDisabled) return undefined;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [realtimeDisabled]);

  // Join user role rooms whenever auth state changes or reconnects
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !user) return;

    if (user.type === 'customer' && user.id) {
      socket.emit('join:customer', user.id);
    } else if (user.type === 'barbershop' && user.id) {
      socket.emit('join:shop', user.id);
    } else if (user.type === 'barber' && user.id) {
      socket.emit('join:barber', user.id);
      if (user.barbershop_id) {
        socket.emit('join:shop', user.barbershop_id);
      }
    }
  }, [user, isConnected]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

/**
 * Hook to subscribe to a barbershop's live queue, chairs, and booking slot events.
 */
export function useShopQueueSocket(shopId, callbacks = {}) {
  const { socket, isConnected } = useSocket();
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!socket || !shopId) return;

    socket.emit('join:shop', shopId);

    const handleQueueUpdate = (data) => {
      if (callbacksRef.current.onQueueUpdate) {
        callbacksRef.current.onQueueUpdate(data);
      }
    };

    const handleSlotBooked = (slot) => {
      if (callbacksRef.current.onSlotBooked) {
        callbacksRef.current.onSlotBooked(slot);
      }
    };

    const handleSlotFreed = (slot) => {
      if (callbacksRef.current.onSlotFreed) {
        callbacksRef.current.onSlotFreed(slot);
      }
    };

    const handleBarberStatus = (barber) => {
      if (callbacksRef.current.onBarberStatus) {
        callbacksRef.current.onBarberStatus(barber);
      }
    };

    const handleApptUpdated = (appt) => {
      if (callbacksRef.current.onApptUpdated) {
        callbacksRef.current.onApptUpdated(appt);
      }
    };

    socket.on('QUEUE_UPDATED', handleQueueUpdate);
    socket.on('SLOT_BOOKED', handleSlotBooked);
    socket.on('SLOT_FREED', handleSlotFreed);
    socket.on('BARBER_STATUS_CHANGED', handleBarberStatus);
    socket.on('APPOINTMENT_UPDATED', handleApptUpdated);

    return () => {
      socket.emit('leave:shop', shopId);
      socket.off('QUEUE_UPDATED', handleQueueUpdate);
      socket.off('SLOT_BOOKED', handleSlotBooked);
      socket.off('SLOT_FREED', handleSlotFreed);
      socket.off('BARBER_STATUS_CHANGED', handleBarberStatus);
      socket.off('APPOINTMENT_UPDATED', handleApptUpdated);
    };
  }, [socket, shopId]);

  return { isConnected };
}

/**
 * Hook to subscribe to explore room for real-time shop queue counters.
 */
export function useExploreSocket(onCounterUpdated) {
  const { socket, isConnected } = useSocket();
  const callbackRef = useRef(onCounterUpdated);
  callbackRef.current = onCounterUpdated;

  useEffect(() => {
    if (!socket) return;

    socket.emit('join:explore');

    const handleCounterUpdate = (data) => {
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    };

    socket.on('SHOP_QUEUE_COUNTER_UPDATED', handleCounterUpdate);

    return () => {
      socket.emit('leave:explore');
      socket.off('SHOP_QUEUE_COUNTER_UPDATED', handleCounterUpdate);
    };
  }, [socket]);

  return { isConnected };
}

/**
 * Hook to subscribe to personal customer alerts (call to chair, next in queue, status updates).
 */
export function useCustomerSocket(customerId, callbacks = {}) {
  const { socket, isConnected } = useSocket();
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!socket || !customerId) return;

    socket.emit('join:customer', customerId);

    const handleCallToChair = (data) => {
      if (callbacksRef.current.onCallToChair) {
        callbacksRef.current.onCallToChair(data);
      }
    };

    const handleNextInQueue = (data) => {
      if (callbacksRef.current.onNextInQueue) {
        callbacksRef.current.onNextInQueue(data);
      }
    };

    const handleApptUpdated = (appt) => {
      if (callbacksRef.current.onApptUpdated) {
        callbacksRef.current.onApptUpdated(appt);
      }
    };

    socket.on('CALL_TO_CHAIR', handleCallToChair);
    socket.on('NEXT_IN_QUEUE', handleNextInQueue);
    socket.on('APPOINTMENT_UPDATED', handleApptUpdated);

    return () => {
      socket.emit('leave:customer', customerId);
      socket.off('CALL_TO_CHAIR', handleCallToChair);
      socket.off('NEXT_IN_QUEUE', handleNextInQueue);
      socket.off('APPOINTMENT_UPDATED', handleApptUpdated);
    };
  }, [socket, customerId]);

  return { isConnected };
}
