/**
 * bluetooth.js
 * Web Bluetooth interface for physical Braille displays.
 *
 * Target: HID-over-GATT Braille displays (BrailleNote Touch, Focus 40 Blue, etc.)
 * Standard service UUID: 'human_interface_device' (0x1812)
 *
 * If no physical display is available (typical at TSA demo), the virtual display
 * in virtual-display.js provides the same output visually on screen.
 */

let device     = null;
let server     = null;
let brailleChar = null;

export const BLUETOOTH_SUPPORTED = 'bluetooth' in navigator;

/**
 * Prompt the user to connect a Braille display via Web Bluetooth.
 * Returns true on success, false if cancelled or unavailable.
 */
export async function connectBrailleDisplay() {
  if (!BLUETOOTH_SUPPORTED) return false;

  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: ['human_interface_device'] },
        { namePrefix: 'Focus'     },
        { namePrefix: 'Braille'   },
        { namePrefix: 'BrailleNote' },
      ],
      optionalServices: ['human_interface_device'],
    });

    server = await device.gatt.connect();

    // HID service
    const service = await server.getPrimaryService('human_interface_device');
    const characteristics = await service.getCharacteristics();

    // Look for a writable characteristic (HID Report)
    brailleChar = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse) ?? null;

    device.addEventListener('gattserverdisconnected', () => {
      device = null; server = null; brailleChar = null;
    });

    return true;
  } catch (err) {
    if (err.name !== 'NotFoundError') console.warn('Bluetooth connect error:', err.message);
    return false;
  }
}

export function isConnected() {
  return !!(device?.gatt?.connected);
}

export function disconnectBrailleDisplay() {
  device?.gatt?.disconnect();
}

/**
 * Send a Braille Unicode string to the physical display.
 * Converts Unicode Braille (U+2800–U+28FF) to raw dot bytes.
 *
 * @param {string} brailleStr  Unicode Braille characters
 */
export async function sendToBrailleDisplay(brailleStr) {
  if (!brailleChar) return;

  // Each Unicode Braille character encodes 8 dots in bits 0–7 of (codepoint - 0x2800)
  const bytes = new Uint8Array(
    brailleStr.split('').map(ch => Math.max(0, ch.codePointAt(0) - 0x2800))
  );

  try {
    if (brailleChar.properties.writeWithoutResponse) {
      await brailleChar.writeValueWithoutResponse(bytes);
    } else {
      await brailleChar.writeValue(bytes);
    }
  } catch (err) {
    console.warn('Braille write error:', err.message);
  }
}
