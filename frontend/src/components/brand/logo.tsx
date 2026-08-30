import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
}

/** Official ShikshaSetu Logo Component using the brand emblem. */
export function Logo({ size = 40, className = "" }: LogoProps) {
  return (
    <img
      src="/shikshasetu-logo.png"
      alt="ShikshaSetu Logo"
      width={size}
      height={size}
      className={`rounded-lg object-contain shrink-0 shadow-xs ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Large emblem mark for hero sections and brand displays. */
export function LogoMark({ size = 200, className = "" }: LogoProps) {
  return (
    <img
      src="/shikshasetu-logo.png"
      alt="ShikshaSetu Mark"
      width={size}
      height={size}
      className={`rounded-2xl object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
