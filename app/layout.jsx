export const metadata = {
  title: 'Simple2Call CTI & CRM Console',
  description: 'SmartCall API & CTI Integration Console',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#f4f6f9' }}>
        {children}
      </body>
    </html>
  );
}
