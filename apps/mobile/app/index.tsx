import { Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Krowdco Platform</Text>
      <StatusBar style="auto" />
    </View>
  )
}
