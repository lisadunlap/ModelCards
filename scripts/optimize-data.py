#!/usr/bin/env python3
"""
Data Optimization Script for Model Property Analyzer

This script processes large CSV files to create optimized versions:
1. Table data: Only essential columns for fast table loading
2. Detail data: Full data but compressed and indexed for quick lookups
3. Optional: Convert to Parquet format for better performance
"""

import pandas as pd
import json
import argparse
from pathlib import Path
import gzip

# Essential columns for table view (fast loading)
TABLE_COLUMNS = [
    'prompt',
    'model', 
    'type',
    'impact',
    'unexpected_behavior',
    'property_description_coarse_cluster_label',
    'property_description_fine_cluster_label',
    'property_description',  # For search and basic display
    'category',  # For filtering
    'evidence'   # Brief evidence
]

# Additional columns for detail view
DETAIL_COLUMNS = [
    'model_1_response',
    'model_2_response', 
    'model_1_name',
    'model_2_name',
    'differences',
    'parsed_differences',
    'parse_error',
    'reason',
    'property_description_coarse_cluster_id',
    'property_description_fine_cluster_id'
]

def optimize_csv_data(input_file, output_dir="./optimized_data", max_detail_rows=10000):
    """
    Optimize CSV data by splitting into table and detail files
    
    Args:
        input_file: Path to input CSV file
        output_dir: Directory to save optimized files
        max_detail_rows: Maximum rows to keep in detail file (for very large datasets)
    """
    print(f"📖 Reading {input_file}...")
    
    # Read the full dataset
    df = pd.read_csv(input_file)
    print(f"✅ Loaded {len(df)} rows, {len(df.columns)} columns")
    
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    # 1. Create table data (lightweight)
    print("🎯 Creating optimized table data...")
    available_table_cols = [col for col in TABLE_COLUMNS if col in df.columns]
    table_df = df[available_table_cols].copy()
    
    # Add row ID for linking to detail data
    table_df['row_id'] = df.index
    
    # Optimize string data (truncate very long descriptions)
    if 'property_description' in table_df.columns:
        table_df['property_description'] = table_df['property_description'].astype(str).str[:500]
    if 'evidence' in table_df.columns:
        table_df['evidence'] = table_df['evidence'].astype(str).str[:300]
    
    # Save table data
    table_file = output_path / "table_data.csv"
    table_df.to_csv(table_file, index=False)
    print(f"💾 Saved table data: {table_file} ({len(table_df)} rows, {len(table_df.columns)} cols)")
    
    # 2. Create detail data (full responses, limited rows)
    print("📋 Creating detail data...")
    all_detail_cols = available_table_cols + [col for col in DETAIL_COLUMNS if col in df.columns]
    detail_df = df[all_detail_cols].copy()
    
    # Limit detail rows if dataset is very large
    if len(detail_df) > max_detail_rows:
        print(f"⚠️  Dataset has {len(detail_df)} rows, sampling {max_detail_rows} for detail view")
        detail_df = detail_df.sample(n=max_detail_rows, random_state=42)
    
    detail_df['row_id'] = detail_df.index
    
    # Save detail data (compressed)
    detail_file = output_path / "detail_data.csv"
    detail_df.to_csv(detail_file, index=False)
    print(f"💾 Saved detail data: {detail_file} ({len(detail_df)} rows)")
    
    # 3. Create compressed versions
    print("🗜️  Creating compressed versions...")
    
    # Compress table data
    table_gz = output_path / "table_data.csv.gz"
    with open(table_file, 'rb') as f_in:
        with gzip.open(table_gz, 'wb') as f_out:
            f_out.writelines(f_in)
    
    # Compress detail data  
    detail_gz = output_path / "detail_data.csv.gz"
    with open(detail_file, 'rb') as f_in:
        with gzip.open(detail_gz, 'wb') as f_out:
            f_out.writelines(f_in)
    
    # 4. Optional: Create Parquet versions
    try:
        print("📦 Creating Parquet versions...")
        table_df.to_parquet(output_path / "table_data.parquet", index=False)
        detail_df.to_parquet(output_path / "detail_data.parquet", index=False)
        print("✅ Parquet files created successfully")
    except ImportError:
        print("⚠️  Parquet creation skipped (install pyarrow: pip install pyarrow)")
    
    # 5. Create index mapping for quick lookups
    print("🔍 Creating lookup index...")
    index_mapping = {
        'total_rows': len(df),
        'table_rows': len(table_df), 
        'detail_rows': len(detail_df),
        'available_columns': {
            'table': available_table_cols,
            'detail': list(set(all_detail_cols))
        },
        'row_id_mapping': detail_df['row_id'].tolist() if len(detail_df) < len(df) else None
    }
    
    index_file = output_path / "data_index.json"
    with open(index_file, 'w') as f:
        json.dump(index_mapping, f, indent=2)
    
    # 6. Calculate size savings
    original_size = Path(input_file).stat().st_size / (1024 * 1024)  # MB
    table_size = table_file.stat().st_size / (1024 * 1024)  # MB
    table_gz_size = table_gz.stat().st_size / (1024 * 1024)  # MB
    
    print("\n📊 Optimization Results:")
    print(f"   Original file: {original_size:.1f} MB")
    print(f"   Table data: {table_size:.1f} MB ({(table_size/original_size)*100:.1f}% of original)")
    print(f"   Table compressed: {table_gz_size:.1f} MB ({(table_gz_size/original_size)*100:.1f}% of original)")
    print(f"   Estimated loading improvement: {original_size/table_gz_size:.1f}x faster")
    
    return {
        'table_file': str(table_file),
        'detail_file': str(detail_file),
        'table_compressed': str(table_gz),
        'detail_compressed': str(detail_gz),
        'index_file': str(index_file)
    }

def main():
    parser = argparse.ArgumentParser(description='Optimize CSV data for Model Property Analyzer')
    parser.add_argument('input_file', help='Path to input CSV file')
    parser.add_argument('--output-dir', default='./optimized_data', help='Output directory')
    parser.add_argument('--max-detail-rows', type=int, default=10000, 
                       help='Maximum rows in detail file (for very large datasets)')
    
    args = parser.parse_args()
    
    if not Path(args.input_file).exists():
        print(f"❌ Error: Input file {args.input_file} not found")
        return 1
    
    try:
        result = optimize_csv_data(args.input_file, args.output_dir, args.max_detail_rows)
        print(f"\n🎉 Optimization complete! Files saved to {args.output_dir}")
        print("\nNext steps:")
        print("1. Update your data source configuration to use optimized files")
        print("2. Implement lazy loading for detail data")
        print("3. Consider using compressed versions for production")
        
        return 0
        
    except Exception as e:
        print(f"❌ Error during optimization: {e}")
        return 1

if __name__ == "__main__":
    exit(main()) 