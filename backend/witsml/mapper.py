from typing import Dict

class MnemonicMapper:
    """Maps vendor-specific WITSML mnemonics to standard Digital Twin tags."""
    
    # Map: Standard Tag -> List of possible source mnemonics
    MAPPING_RULES = {
        "HookLoad": ["HKLD", "HKLDA", "HOOK_LOAD", "HKLD_K"],
        "ROP": ["ROP", "ROP_AVG", "ROP5", "ROPA"],
        "WOB": ["WOB", "WOB_AVG", "WOBA", "WEIGHT_ON_BIT"],
        "Torque": ["TRQ", "TORQUE", "TQ", "TRQA"],
        "RPM": ["RPM", "RPMA", "ROT_SPEED", "SRPM"],
        "StandpipePressure": ["SPP", "SPPA", "STANDPIPE_PRESS"],
        "FlowRate": ["FLOW", "FLOW_IN", "GPM", "FLOWA"],
        "Depth": ["DEPT", "DEPTH", "MD"],
        "BitDepth": ["BIT_DEPTH", "DBTM"],
    }

    @staticmethod
    def map_curve(mnemonic: str, custom_mappings: Dict[str, str] = None) -> str:
        """Returns the standard tag for a given mnemonic, or the mnemonic itself if no match."""
        mnemonic_upper = mnemonic.upper()
        
        # 1. Check custom mappings from DB first
        if custom_mappings and mnemonic_upper in custom_mappings:
            return custom_mappings[mnemonic_upper]
            
        # 2. Fallback to static rules
        for std_tag, variations in MnemonicMapper.MAPPING_RULES.items():
            if mnemonic_upper in variations:
                return std_tag
        return mnemonic

    @staticmethod
    def map_dataframe(df, custom_mappings: Dict[str, str] = None):
        """Renames DataFrame columns based on mapping rules."""
        new_columns = {}
        for col in df.columns:
            new_columns[col] = MnemonicMapper.map_curve(col, custom_mappings)
        return df.rename(columns=new_columns)
