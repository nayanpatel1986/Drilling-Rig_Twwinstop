from(bucket: "rig_data")
  |> range(start: -1h)
  |> last()
  |> limit(n: 10)
