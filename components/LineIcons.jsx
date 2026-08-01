"use client";
import React from "react";

export function IconEspada({ color, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <line x1="10" y1="2" x2="10" y2="14" stroke={color} strokeWidth="1.6" />
      <line x1="5.5" y1="6" x2="14.5" y2="6" stroke={color} strokeWidth="1.6" />
      <path d="M8 14H12L10 18L8 14Z" fill={color} />
    </svg>
  );
}
export function IconBasto({ color, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <line x1="5" y1="16" x2="15" y2="4" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="6" cy="15" r="1.9" fill={color} />
      <circle cx="14" cy="5" r="1.9" fill={color} />
    </svg>
  );
}
export function IconOro({ color, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke={color} strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2.9" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}
export function IconCopa({ color, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M4 3H16L13.2 10.5C12.5 12.3 11 13 10 13C9 13 7.5 12.3 6.8 10.5L4 3Z"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <line x1="10" y1="13" x2="10" y2="16.5" stroke={color} strokeWidth="1.4" />
      <line x1="6.5" y1="17.5" x2="13.5" y2="17.5" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}
export function IconDoc({ color, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2.5" stroke={color} strokeWidth="1.6" />
      <line x1="7" y1="6" x2="13" y2="6" stroke={color} strokeWidth="1.4" />
      <line x1="7" y1="9.5" x2="13" y2="9.5" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}
export function IconOjo({ color, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.6" />
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}
export function IconEstrella({ color, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l2.6 6.6L21 9l-5 4.6L17.3 21 12 17.3 6.7 21 8 13.6 3 9l6.4-.4z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function IconAnotador({ color, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="2.5" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="8" x2="16" y2="8" stroke={color} strokeWidth="1.4" />
      <line x1="8" y1="12" x2="16" y2="12" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}
export function IconAtras({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconAdelante({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconAbajo({ color, size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconLuna({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function IconSol({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4.5" stroke={color} strokeWidth="1.6" />
      <line x1="12" y1="2" x2="12" y2="4.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="12" y1="19.5" x2="12" y2="22" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="12" x2="4.5" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="19.5" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="4.6" y1="4.6" x2="6.3" y2="6.3" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="17.7" y1="17.7" x2="19.4" y2="19.4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="4.6" y1="19.4" x2="6.3" y2="17.7" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="17.7" y1="6.3" x2="19.4" y2="4.6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
export function IconUsuario({ color, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="1.8" />
      <path d="M4.5 20c1.6-3.6 4.6-5.5 7.5-5.5s5.9 1.9 7.5 5.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
export function IconLapiz({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20l1-4 11-11 3 3-11 11-4 1z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function IconBasura({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M9 7V4.5a1 1 0 011-1h4a1 1 0 011 1V7m-9 0l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function IconPuntos({ color, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}
export function IconCopiar({ color, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="8" y="8" width="12" height="13" rx="2" stroke={color} strokeWidth="1.6" />
      <path d="M5 15V5a2 2 0 012-2h9" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
export function IconWhatsApp({ color = "#1B3A2A", size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2zm5.6 14.3c-.2.6-1.4 1.2-1.9 1.3-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1 0-1.5.8-2.2 1.1-2.5.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.2.6.7 1.9.8 2 .1.2.1.3 0 .5-.1.2-.2.3-.3.5-.2.2-.3.3-.5.5-.2.2-.3.4-.1.7.2.3.9 1.5 1.9 2.4 1.3 1.2 2.4 1.5 2.7 1.7.3.2.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.2.7-.1.3.1 1.8.8 2.1 1 .3.1.5.2.6.3.1.2.1.9-.1 1.6z" />
    </svg>
  );
}
