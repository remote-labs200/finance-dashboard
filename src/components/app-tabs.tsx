import { NativeTabs } from 'expo-router/unstable-native-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useResolvedThemeName } from '@/hooks/use-theme';
import { Colors } from '@/constants/theme';

export default function AppTabs() {
 const resolvedScheme = useResolvedThemeName();
 const colors = Colors[resolvedScheme];

 return (
   <NativeTabs
     backgroundColor={colors.background}
     indicatorColor={colors.backgroundElement}
     labelStyle={{ selected: { color: colors.text } }}>
     <NativeTabs.Trigger name="index">
       <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
       <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="home-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="swap-horizontal-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="scan">
        <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="camera-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="reports">
        <NativeTabs.Trigger.Label>Reports</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="document-text-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="clients">
        <NativeTabs.Trigger.Label>Clients</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="people-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="person-outline" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
