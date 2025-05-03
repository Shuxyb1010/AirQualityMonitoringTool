import "./globals.css";
import NavBar from "../components/shared/NavBar";

export const metadata = {
  title: "AirQual",
  description: "An air quality monitoring application",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex flex-col h-screen">
        <NavBar />
        <main className="flex flex-1">{children}</main>
      </body>
    </html>
  );
}
