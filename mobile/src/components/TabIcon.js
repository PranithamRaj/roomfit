import { Ionicons } from '@expo/vector-icons';

// Filled icon for the active tab, outline for the rest.
export default function TabIcon({ name, color, size, focused }) {
  return <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />;
}
