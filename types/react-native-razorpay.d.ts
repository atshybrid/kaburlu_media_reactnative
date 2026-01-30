/**
 * Type declarations for react-native-razorpay
 */

declare module 'react-native-razorpay' {
  export interface RazorpayOptions {
    description?: string;
    image?: string;
    currency: string;
    key: string;
    amount: number;
    order_id: string;
    name: string;
    prefill?: {
      contact?: string;
      name?: string;
      email?: string;
    };
    theme?: {
      color?: string;
    };
    external?: {
      wallets?: string[];
    };
    notes?: Record<string, string>;
    modal?: {
      confirm_close?: boolean;
      animation?: boolean;
    };
    remember_customer?: boolean;
    retry?: {
      enabled?: boolean;
      max_count?: number;
    };
  }

  export interface RazorpayPaymentResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  export interface RazorpayError {
    code: number;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  }

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpayPaymentResponse>;
  };

  export default RazorpayCheckout;
}
