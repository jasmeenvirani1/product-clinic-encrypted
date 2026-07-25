export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-4">
      <p className="text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Admin Panel. All rights reserved.
      </p>
    </footer>
  );
}
