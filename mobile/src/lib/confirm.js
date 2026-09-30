import { Alert, Platform } from 'react-native';

// Resolves true if the user confirms a destructive or significant action.
export const confirmAction = (title, body, confirmLabel = 'Confirm') =>
  Platform.OS === 'web'
    ? Promise.resolve(window.confirm(`${title}\n${body}`))
    : new Promise((resolve) =>
        Alert.alert(title, body, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
        ]));
