import { View } from "react-native";

import AppTabs from "@/components/app-tabs";
import { useNavbarPosition } from "@/stores/use-ui-prefs";

export default function MainLayout() {
  const navbarPosition = useNavbarPosition();

  return (
    <View style={{ flex: 1 }}>
      <AppTabs tabBarPosition={navbarPosition} />
    </View>
  );
}
