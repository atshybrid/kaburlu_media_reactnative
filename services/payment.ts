/**
 * Payment Service - Razorpay Integration
 * 
 * Handles Razorpay payment checkout and verification for reporter subscriptions.
 * Used when login returns 402 (Payment Required) with Razorpay order data.
 */

import { Alert, Platform } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { request } from './http';

// ============================================================================
// TYPES
// ============================================================================

export interface RazorpayOrderData {
  orderId: string;
  keyId: string;
  amount: number; // in paise (e.g., 200 = ₹2)
  currency: string;
  reporterPaymentId?: string;
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface PaymentResult {
  success: boolean;
  paymentData?: RazorpayPaymentResponse;
  error?: string;
  cancelled?: boolean;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message?: string;
}

// ============================================================================
// RAZORPAY CHECKOUT
// ============================================================================

/**
 * Opens Razorpay checkout modal for payment
 * @param razorpayData - Order data received from 402 login response
 * @param reporterInfo - Optional prefill info for the payment form
 * @returns PaymentResult with payment data on success
 */
export async function openRazorpayCheckout(
  razorpayData: RazorpayOrderData,
  reporterInfo?: {
    name?: string;
    mobile?: string;
    email?: string;
  }
): Promise<PaymentResult> {
  console.log('[PAYMENT] openRazorpayCheckout called with', {
    razorpayData: JSON.stringify(razorpayData),
    hasOrderId: !!razorpayData?.orderId,
    hasKeyId: !!razorpayData?.keyId,
    amount: razorpayData?.amount,
  });

  if (!razorpayData.orderId || !razorpayData.keyId) {
    console.error('[PAYMENT] Missing Razorpay order data', razorpayData);
    return {
      success: false,
      error: 'Payment configuration not available. Please contact support.',
    };
  }

  const options = {
    description: 'Reporter Subscription Payment',
    image: 'https://app.kaburlumedia.com/logo.png', // App logo
    currency: razorpayData.currency || 'INR',
    key: razorpayData.keyId,
    amount: Number(razorpayData.amount), // Ensure it's a number, in paise
    order_id: String(razorpayData.orderId), // Ensure it's a string
    name: 'Kaburlu Media',
    prefill: {
      contact: reporterInfo?.mobile || '',
      name: reporterInfo?.name || '',
      email: reporterInfo?.email || '',
    },
    theme: {
      color: '#0D47A1', // Brand primary color
    },
    // Android-specific options
    ...(Platform.OS === 'android' && {
      external: {
        wallets: ['paytm'],
      },
    }),
  };

  console.log('[PAYMENT] Razorpay options', JSON.stringify(options, null, 2));

  try {
    const paymentData: RazorpayPaymentResponse = await RazorpayCheckout.open(options);
    
    console.log('[PAYMENT] Razorpay payment successful', {
      orderId: paymentData.razorpay_order_id,
      paymentId: paymentData.razorpay_payment_id,
    });

    return {
      success: true,
      paymentData,
    };
  } catch (error: any) {
    console.error('[PAYMENT] Razorpay checkout error', error);

    // Error code 0 means user cancelled
    if (error?.code === 0) {
      return {
        success: false,
        cancelled: true,
        error: 'Payment cancelled by user',
      };
    }

    // Error code 1 means payment failed
    if (error?.code === 1) {
      return {
        success: false,
        error: error?.description || 'Payment failed. Please try again.',
      };
    }

    // Error code 2 means network error
    if (error?.code === 2) {
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.',
      };
    }

    return {
      success: false,
      error: error?.description || error?.message || 'Payment failed',
    };
  }
}

// ============================================================================
// PAYMENT VERIFICATION
// ============================================================================

/**
 * Verifies payment with the backend after successful Razorpay checkout
 * This is a PUBLIC endpoint - NO JWT required!
 * @param paymentData - Payment data received from Razorpay checkout
 * @param reporterInfo - Reporter and tenant IDs for finding the payment record
 * @returns Whether verification was successful
 */
export async function verifyPayment(
  paymentData: RazorpayPaymentResponse,
  reporterInfo?: { reporterId?: string; tenantId?: string }
): Promise<boolean> {
  console.log('[PAYMENT] Verifying payment', {
    orderId: paymentData.razorpay_order_id,
    paymentId: paymentData.razorpay_payment_id,
    reporterId: reporterInfo?.reporterId,
  });

  try {
    // PUBLIC ENDPOINT - No JWT needed (noAuth: true)
    const response = await request<VerifyPaymentResponse>(
      '/public/reporter-payments/verify',
      {
        method: 'POST',
        body: {
          razorpay_order_id: paymentData.razorpay_order_id,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_signature: paymentData.razorpay_signature,
          reporterId: reporterInfo?.reporterId,
          tenantId: reporterInfo?.tenantId,
        },
        noAuth: true, // This is important - no JWT required
      }
    );

    console.log('[PAYMENT] Verification response', response);

    return response?.success === true;
  } catch (error: any) {
    console.error('[PAYMENT] Verification failed', error);
    return false;
  }
}

// ============================================================================
// PAYMENT FLOW HELPER
// ============================================================================

/**
 * Complete payment flow: Opens checkout and verifies payment
 * @param razorpayData - Order data from 402 login response
 * @param reporterInfo - Optional prefill info
 * @returns Whether payment was completed and verified successfully
 */
export async function handleReporterPaymentFlow(
  razorpayData: RazorpayOrderData,
  reporterInfo?: {
    name?: string;
    mobile?: string;
    email?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
  cancelled?: boolean;
}> {
  // Step 1: Open Razorpay checkout
  const paymentResult = await openRazorpayCheckout(razorpayData, reporterInfo);

  if (!paymentResult.success) {
    return {
      success: false,
      error: paymentResult.error,
      cancelled: paymentResult.cancelled,
    };
  }

  if (!paymentResult.paymentData) {
    return {
      success: false,
      error: 'Payment data missing after checkout',
    };
  }

  // Step 2: Verify payment with backend
  const verified = await verifyPayment(paymentResult.paymentData);

  if (!verified) {
    return {
      success: false,
      error: 'Payment verification failed. Please contact support if amount was deducted.',
    };
  }

  console.log('[PAYMENT] Payment flow completed successfully');

  return {
    success: true,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats amount in paise to rupees for display
 * @param amountInPaise - Amount in paise (e.g., 20000 for ₹200)
 * @returns Formatted string (e.g., "₹200")
 */
export function formatPaymentAmount(amountInPaise: number): string {
  const rupees = amountInPaise / 100;
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/**
 * Shows a payment required alert with Pay Now option
 * @param razorpayData - Order data from 402 response
 * @param reporterInfo - Optional prefill info
 * @param onPaymentComplete - Callback when payment succeeds (should retry login)
 * @param onCancel - Callback when user cancels
 */
export function showPaymentRequiredAlert(
  razorpayData: RazorpayOrderData,
  reporterInfo?: { name?: string; mobile?: string; email?: string },
  onPaymentComplete?: () => void,
  onCancel?: () => void
): void {
  const amount = formatPaymentAmount(razorpayData.amount);

  Alert.alert(
    'Payment Required',
    `Please complete your subscription payment of ${amount} to continue.`,
    [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: 'Pay Now',
        onPress: async () => {
          const result = await handleReporterPaymentFlow(razorpayData, reporterInfo);

          if (result.success) {
            Alert.alert(
              'Payment Successful',
              'Your payment was successful. Logging you in...',
              [{ text: 'OK', onPress: onPaymentComplete }]
            );
          } else if (!result.cancelled) {
            Alert.alert('Payment Failed', result.error || 'Please try again.');
          }
        },
      },
    ]
  );
}
