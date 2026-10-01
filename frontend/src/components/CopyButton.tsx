import { useState } from 'react';
import { Button, Tooltip } from '@mantine/core';
import { Copy, Check } from 'lucide-react';

interface Props {
  text: string;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'light' | 'subtle' | 'filled';
}

export function CopyButton({ text, label, size = 'xs', variant = 'light' }: Props) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback for older browsers / http
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Tooltip label={copied ? 'Copied!' : 'Copy to clipboard'} withArrow>
      <Button
        size={size}
        variant={variant}
        color={copied ? 'green' : 'indigo'}
        leftSection={copied ? <Check size={14} /> : <Copy size={14} />}
        onClick={onClick}
        style={{ minWidth: 90 }}
      >
        {copied ? 'Copied' : (label ?? 'Copy')}
      </Button>
    </Tooltip>
  );
}
