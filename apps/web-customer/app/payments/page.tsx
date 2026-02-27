"use client";

import { useState } from "react";

interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'debit_card' | 'wallet';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

interface Transaction {
  id: string;
  rideId: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  date: string;
  description: string;
}

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<'methods' | 'history'>('history');
  const [addingCard, setAddingCard] = useState(false);

  // Mock data
  const paymentMethods: PaymentMethod[] = [
    {
      id: '1',
      type: 'credit_card',
      last4: '4242',
      brand: 'Visa',
      expiryMonth: 12,
      expiryYear: 2026,
      isDefault: true
    },
    {
      id: '2',
      type: 'credit_card',
      last4: '5555',
      brand: 'Mastercard',
      expiryMonth: 8,
      expiryYear: 2025,
      isDefault: false
    },
    {
      id: '3',
      type: 'wallet',
      isDefault: false
    }
  ];

  const transactions: Transaction[] = [
    {
      id: 'tx_1',
      rideId: 'ride_123',
      amount: 150,
      status: 'completed',
      paymentMethod: 'Visa ****4242',
      date: '2026-02-09T14:30:00',
      description: 'Ride from Taksim to Kadıköy'
    },
    {
      id: 'tx_2',
      rideId: 'ride_122',
      amount: 85,
      status: 'completed',
      paymentMethod: 'KargoGig Wallet',
      date: '2026-02-08T10:15:00',
      description: 'Ride from Beşiktaş to Şişli'
    },
    {
      id: 'tx_3',
      rideId: 'ride_121',
      amount: 200,
      status: 'refunded',
      paymentMethod: 'Mastercard ****5555',
      date: '2026-02-07T16:45:00',
      description: 'Cancelled ride - Refunded'
    },
    {
      id: 'tx_4',
      rideId: 'ride_120',
      amount: 120,
      status: 'completed',
      paymentMethod: 'Visa ****4242',
      date: '2026-02-06T09:20:00',
      description: 'Ride from Levent to Etiler'
    }
  ];

  const walletBalance = 250;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'failed': return '#ef4444';
      case 'refunded': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getCardIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa': return '💳';
      case 'mastercard': return '💳';
      case 'amex': return '💳';
      default: return '💳';
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: 20 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ fontSize: 24, textDecoration: 'none' }}>←</a>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Payments</h1>
        </div>

        {/* Wallet Balance Card */}
        <div style={{
          backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: 24,
          borderRadius: 16,
          marginBottom: 24,
          color: 'white',
          boxShadow: '0 10px 25px rgba(102, 126, 234, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>KargoGig Wallet</div>
              <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 16 }}>₺{walletBalance}</div>
              <button style={{
                padding: '8px 20px',
                backgroundColor: 'white',
                color: '#667eea',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}>
                + Add Funds
              </button>
            </div>
            <div style={{ fontSize: 48 }}>👛</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ 
          marginBottom: 24, 
          display: 'flex', 
          gap: 8,
          borderBottom: '1px solid #e5e7eb'
        }}>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              color: activeTab === 'history' ? '#3b82f6' : '#6b7280',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'history' ? '#3b82f6' : 'transparent'}`,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Transaction History
          </button>
          <button
            onClick={() => setActiveTab('methods')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              color: activeTab === 'methods' ? '#3b82f6' : '#6b7280',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'methods' ? '#3b82f6' : 'transparent'}`,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Payment Methods
          </button>
        </div>

        {/* Transaction History Tab */}
        {activeTab === 'history' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {transactions.map(transaction => (
              <div
                key={transaction.id}
                style={{
                  backgroundColor: 'white',
                  padding: 20,
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ 
                      padding: '2px 8px', 
                      backgroundColor: getStatusColor(transaction.status) + '20',
                      color: getStatusColor(transaction.status),
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600
                    }}>
                      {transaction.status.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 13, color: '#999' }}>
                      {new Date(transaction.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                    {transaction.description}
                  </div>
                  <div style={{ fontSize: 13, color: '#666' }}>
                    {transaction.paymentMethod}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: 20, 
                    fontWeight: 700,
                    color: transaction.status === 'refunded' ? '#6b7280' : '#111827'
                  }}>
                    {transaction.status === 'refunded' ? '-' : ''}₺{transaction.amount}
                  </div>
                  <a 
                    href={`/rides/${transaction.rideId}`}
                    style={{ fontSize: 13, color: '#3b82f6', textDecoration: 'none' }}
                  >
                    View Ride →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payment Methods Tab */}
        {activeTab === 'methods' && (
          <div>
            <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
              {paymentMethods.map(method => (
                <div
                  key={method.id}
                  style={{
                    backgroundColor: 'white',
                    padding: 20,
                    borderRadius: 12,
                    border: method.isDefault ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    position: 'relative'
                  }}
                >
                  {method.isDefault && (
                    <div style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      padding: '4px 10px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600
                    }}>
                      DEFAULT
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontSize: 40 }}>
                      {method.type === 'wallet' ? '👛' : getCardIcon(method.brand || '')}
                    </div>
                    <div style={{ flex: 1 }}>
                      {method.type === 'wallet' ? (
                        <>
                          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                            KargoGig Wallet
                          </div>
                          <div style={{ fontSize: 14, color: '#666' }}>
                            Balance: ₺{walletBalance}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                            {method.brand} •••• {method.last4}
                          </div>
                          <div style={{ fontSize: 14, color: '#666' }}>
                            Expires {method.expiryMonth?.toString().padStart(2, '0')}/{method.expiryYear}
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!method.isDefault && (
                        <button style={{
                          padding: '6px 14px',
                          backgroundColor: 'white',
                          color: '#3b82f6',
                          border: '1px solid #3b82f6',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}>
                          Set Default
                        </button>
                      )}
                      <button style={{
                        padding: '6px 14px',
                        backgroundColor: 'white',
                        color: '#ef4444',
                        border: '1px solid #ef4444',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Payment Method */}
            {addingCard ? (
              <div style={{
                backgroundColor: 'white',
                padding: 24,
                borderRadius: 12,
                border: '1px solid #e5e7eb'
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Add New Card</h3>
                <div style={{ display: 'grid', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                      Card Number
                    </label>
                    <input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: 14
                      }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        maxLength={5}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: 8,
                          fontSize: 14
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                        CVV
                      </label>
                      <input
                        type="text"
                        placeholder="123"
                        maxLength={4}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: 8,
                          fontSize: 14
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: 14
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => setAddingCard(false)}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        backgroundColor: 'white',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Add Card
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingCard(true)}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  backgroundColor: 'white',
                  color: '#3b82f6',
                  border: '2px dashed #3b82f6',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <span style={{ fontSize: 20 }}>+</span>
                Add Payment Method
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
