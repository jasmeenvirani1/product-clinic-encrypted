"use client";

import { ConfigProvider, App as AntApp } from "antd";
import type { ReactNode } from "react";
import { COLORS } from "@/constants/brand";
import { useThemeColors } from "./ThemeProvider";

export function AntdProvider({ children }: { children: ReactNode }) {
  const { colors } = useThemeColors();
  const c = colors ?? COLORS;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary:   c.primary,
          colorLink:      c.primary,
          borderRadius:   8,
          colorBgLayout:  c.brandBg,
          fontFamily:     "var(--font-dm-sans), 'DM Sans', sans-serif",
          colorBgBase:    c.brandBg,
          colorTextBase:  c.textPrimary,
          colorBorder:    c.brandBorder,
          colorSuccess:   c.success,
          colorWarning:   c.warning,
          colorError:     c.error,
        },
        components: {
          Menu: {
            itemSelectedBg:    c.sidebarActive,
            itemSelectedColor: c.primary,
            itemHoverBg:       c.sidebarHover,
            itemHoverColor:    c.primary,
            itemColor:         c.textPrimary,
          },
          Button: {
            primaryColor: c.sidebarBg,
            borderRadius: 4,
          },
          Card: {
            borderRadiusLG:       12,
            colorBgContainer:     c.brandCard,
            colorBorderSecondary: c.brandBorder,
          },
          Table: {
            headerBg:    c.brandBg,
            headerColor: c.textPrimary,
            borderColor: c.brandBorder,
          },
          Input: {
            borderRadius:  8,
            controlHeight: 38,
            paddingBlock:  7,
          },
          Select: {
            borderRadius:        8,
            controlHeight:       38,
            controlOutline:      "none",
            controlOutlineWidth: 0,
          },
          Tabs: {
            inkBarColor:       c.primary,
            itemSelectedColor: c.primary,
            itemHoverColor:    c.primaryDark,
          },
          Tag: {
            borderRadiusSM: 6,
          },
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
