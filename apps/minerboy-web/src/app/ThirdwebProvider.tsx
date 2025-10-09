'use client';

import { ThirdwebProvider } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';

// Initialize Thirdweb client
const thirdwebClient = createThirdwebClient({
  clientId: 'c7092085d8fa5c3ec2ed5d1598ec5206',
});

export default function ThirdwebProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}

export { thirdwebClient };

