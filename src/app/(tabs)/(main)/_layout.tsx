import { View } from "react-native";

import AppTabs from "@/components/app-tabs";

export default function MainLayout() {
  return (
    <View style={{ flex: 1 }}>
      <AppTabs />
    </View>
  );
}
