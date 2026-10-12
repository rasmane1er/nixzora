import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type View } from 'react-native';

/** Whether the on-screen keyboard is up (iOS reports it a moment earlier than Android). */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/** How tall the on-screen keyboard is now (0 when it's down). */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * Where a view starts on screen, for KeyboardAvoidingView's `keyboardVerticalOffset` under a
 * header. Measured, not guessed: the header's height differs between iOS and Android (and with
 * Android's edge-to-edge status bar), and a fixed number left the help chat's field under the
 * keyboard on Android.
 */
export function useTopInWindow(): {
  ref: RefObject<View | null>;
  onLayout: () => void;
  top: number;
} {
  const ref = useRef<View>(null);
  const [top, setTop] = useState(0);
  const onLayout = useCallback(() => {
    ref.current?.measureInWindow((_x, y) => setTop(Math.max(0, Math.round(y))));
  }, []);
  return { ref, onLayout, top };
}
