package com.burlington.darkskies;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ClearSkyHomeWidgetProvider.refreshAllAsync(this, false);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (ClearSkyNativeForecastManager.isCacheStale(this)) {
            ClearSkyHomeWidgetProvider.refreshAllAsync(this, false);
        }
    }
}
