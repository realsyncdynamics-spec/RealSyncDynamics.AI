import React, { useEffect } from 'react';

export function WaitlistSection() {
    useEffect(() => {
          const existing = document.querySelector('script[src="https://tally.so/widgets/embed.js"]');
          if (!existing) {
                  const script = do
