import React from 'react';

export const BrandLogo: React.FC<{ className?: string }> = ({ className = 'h-6 w-6' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M32 5L55.5 18.5V45.5L32 59L8.5 45.5V18.5L32 5Z"
      fill="#081229"
      stroke="#00E5FF"
      strokeWidth="3.2"
      strokeLinejoin="round"
    />
    <path
      d="M32 15L46.5 23.4V40.6L32 49L17.5 40.6V23.4L32 15Z"
      stroke="#10B981"
      strokeWidth="2.2"
      strokeLinejoin="round"
      strokeOpacity="0.9"
    />
    <path
      d="M32 5V15M55.5 18.5L46.5 23.4M55.5 45.5L46.5 40.6M32 59V49M8.5 45.5L17.5 40.6M8.5 18.5L17.5 23.4"
      stroke="#00E5FF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeOpacity="0.85"
    />
    <circle cx="32" cy="32" r="5.5" fill="#00E5FF" />
  </svg>
);
